import { loadConfig } from "./config";
import { createContainer } from "./container";
import { createApp } from "./app";
import { attachRealtime } from "./realtime";
import { initSentry } from "./sentry";

async function main() {
  const config = loadConfig();
  initSentry(config);
  const container = createContainer(config);
  const app = await createApp(container);
  await app.init();
  const server = app.getHttpServer() as import("node:http").Server;
  const realtime = attachRealtime(server, container);
  await app.listen(config.port, "0.0.0.0");
  container.logger.info({ port: config.port, env: config.appEnv }, "api listening");

  const shutdown = async (signal: string) => {
    container.logger.info({ signal }, "api shutting down");
    await realtime.close();
    await app.close();
    await container.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
