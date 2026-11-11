import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { REALTIME_CHANNEL_PREFIX } from "@hkfinhub/notifications";
import type { Container } from "./container";

/**
 * Socket.IO gateway. Clients connect with their access token in the handshake, and receive only
 * events for their own user. Events arrive from Redis pub/sub, so every API instance delivers them.
 */
export function attachRealtime(httpServer: HttpServer, c: Container): { io: Server | null; close(): Promise<void> } {
  // Live updates need Redis. Without it there is nothing to subscribe to, so no socket server is started.
  if (!c.redis) return { io: null, close: async () => {} };
  const io = new Server(httpServer, {
    path: "/v1/realtime",
    cors: { origin: c.config.corsOrigins, credentials: true },
    serveClient: false,
    maxHttpBufferSize: 16 * 1024,
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.["token"];
    if (typeof token !== "string") return next(new Error("unauthorised"));
    try {
      const auth = await c.auth.authenticate(token);
      socket.data["userId"] = auth.userId;
      socket.data["sessionId"] = auth.sessionId;
      next();
    } catch {
      next(new Error("unauthorised"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${String(socket.data["userId"])}`);
  });

  // Dedicated subscriber connection: a subscribed ioredis client cannot run other commands.
  const sub = c.redis.duplicate();
  void sub.psubscribe(`${REALTIME_CHANNEL_PREFIX}*`).catch((err: unknown) => c.logger.error({ err }, "realtime subscribe failed"));
  sub.on("pmessage", (_pattern, channel, message) => {
    const userId = channel.slice(REALTIME_CHANNEL_PREFIX.length);
    try {
      io.to(`user:${userId}`).emit("event", JSON.parse(message) as unknown);
    } catch (err) {
      c.logger.warn({ err }, "dropped malformed realtime message");
    }
  });

  return {
    io,
    async close() {
      await sub.quit();
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
