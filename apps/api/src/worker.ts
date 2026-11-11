import { loadConfig } from "./config";
import { createContainer } from "./container";
import { startNotificationWorker } from "./worker-loop";

const config = loadConfig();
const container = createContainer(config);
const worker = startNotificationWorker(container);
container.logger.info({ env: config.appEnv }, "notification worker started");

async function shutdown(signal: string) {
  container.logger.info({ signal }, "worker shutting down");
  await worker.stop();
  await container.close();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
