import request from "supertest";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import { relayOutbox, CaptureSender, REALTIME_CHANNEL_PREFIX, deliver, type NotificationJob } from "@hkfinhub/notifications";
import { NOTIFICATION_QUEUE } from "../src/container";
import { attachRealtime } from "../src/realtime";
import { startTestApp, resetState, codeSentTo, PASSWORD, DEVICE, type TestApp } from "./helpers";

let t: TestApp;
const http = () => request(t.app.getHttpServer());
const EMAIL = "fay.leung@example.com";
const PHONE = "+85264445555";

beforeAll(async () => { t = await startTestApp(); });
afterAll(async () => { await t.close(); });
beforeEach(async () => { await resetState(t); });

async function activeAccount(): Promise<void> {
  await http().post("/v1/auth/register").send({ email: EMAIL, phone: PHONE, password: PASSWORD, fullName: "Fay Leung", countryCode: "HK", language: "en" }).expect(202);
  await t.drain();
  await http().post("/v1/auth/otp/verify").send({ email: EMAIL, channel: "EMAIL", code: codeSentTo(t.email, EMAIL) }).expect(200);
  await http().post("/v1/auth/otp/verify").send({ email: EMAIL, channel: "SMS", code: codeSentTo(t.sms, PHONE) }).expect(200);
}

describe("notification pipeline on BullMQ", () => {
  it("relays outbox rows through the real queue and a real worker, then redacts them", async () => {
    const email = new CaptureSender();
    const sms = new CaptureSender();
    const redis = new Redis(t.config.redisUrl, { maxRetriesPerRequest: null });
    const queue = new Queue(NOTIFICATION_QUEUE, { connection: redis.duplicate() });
    const worker = new Worker<NotificationJob>(
      NOTIFICATION_QUEUE,
      (job) => deliver(job.data, { store: t.container.outbox, email, sms, realtime: t.container.realtime, fieldKey: t.config.fieldKey }),
      { connection: redis.duplicate() },
    );
    const jobQueue = {
      add: async (jobId: string, data: NotificationJob) => {
        await queue.add("deliver", data, { jobId, attempts: 3, backoff: { type: "fixed", delay: 100 }, removeOnComplete: true });
      },
    };
    try {
      await http().post("/v1/auth/register").send({ email: EMAIL, phone: PHONE, password: PASSWORD, fullName: "Fay Leung", countryCode: "HK", language: "en" }).expect(202);
      await relayOutbox(t.container.outbox, jobQueue);
      await waitFor(() => email.sent.length >= 1 && sms.sent.length >= 1);
      const code = codeSentTo(email, EMAIL);
      expect(code).toMatch(/^\d{6}$/);
      await waitFor(async () => (await t.container.db.outboxEvent.count({ where: { publishedAt: null } })) === 0);
      const rows = await t.container.db.outboxEvent.findMany();
      expect(rows.every((r) => (r.payload as Record<string, unknown>)["redacted"] === true)).toBe(true);
    } finally {
      await worker.close();
      await queue.close();
      await redis.quit();
    }
  });

  it("does not deliver the same notification twice when the relay runs twice", async () => {
    await http().post("/v1/auth/register").send({ email: EMAIL, phone: PHONE, password: PASSWORD, fullName: "Fay Leung", countryCode: "HK", language: "en" });
    const seen: string[] = [];
    const q = { add: async (id: string) => { seen.push(id); } };
    await relayOutbox(t.container.outbox, q);
    await relayOutbox(t.container.outbox, q);
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe("realtime notifications", () => {
  // One gateway per suite: it attaches to the shared HTTP server.
  let rt: ReturnType<typeof attachRealtime>;
  beforeAll(() => { rt = attachRealtime(t.app.getHttpServer(), t.container); });
  afterAll(async () => { await rt.close(); });

  it("pushes a security notification to the signed-in user's socket", async () => {
    await activeAccount();
    const first = await http().post("/v1/auth/login").send({ email: EMAIL, password: PASSWORD, device: DEVICE }).expect(200);
    const address = (t.app.getHttpServer() as import("node:http").Server).address();
    const port = typeof address === "object" && address ? address.port : 0;
    const socket: Socket = connect(`http://127.0.0.1:${port}`, {
      path: "/v1/realtime",
      auth: { token: first.body.tokens.accessToken },
      transports: ["websocket"],
      reconnection: false,
    });
    try {
      // Resolve only on the security event this test causes, not on earlier queued notifications.
      const got = new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("no security event within 5s")), 5000);
        socket.on("event", (e: { data?: { category?: string } }) => {
          if (e.data?.category !== "security") return;
          clearTimeout(timer);
          resolve(e);
        });
        socket.on("connect_error", (err) => { clearTimeout(timer); reject(err); });
      });
      await waitFor(() => socket.connected);
      await http().post("/v1/auth/password/change").set("Authorization", `Bearer ${first.body.tokens.accessToken}`).send({ current: PASSWORD, next: "a-new-passphrase-for-fay-2" }).expect(200);
      await t.drain();
      const event = await got;
      expect(event).toMatchObject({ type: "notification", data: { category: "security" } });
    } finally {
      socket.close();
    }
  });

  it("refuses a socket without a valid access token", async () => {
    const address = (t.app.getHttpServer() as import("node:http").Server).address();
    const port = typeof address === "object" && address ? address.port : 0;
    const socket = connect(`http://127.0.0.1:${port}`, { path: "/v1/realtime", auth: { token: "nope" }, transports: ["websocket"], reconnection: false });
    try {
      const err = await new Promise<Error>((resolve) => socket.on("connect_error", (e) => resolve(e)));
      expect(err.message).toBe("unauthorised");
    } finally {
      socket.close();
    }
  });

  it("publishes to the user channel name used by the gateway", () => {
    expect(REALTIME_CHANNEL_PREFIX).toBe("realtime:user:");
  });
});

async function waitFor(cond: () => boolean | Promise<boolean>, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("condition not met in time");
}
