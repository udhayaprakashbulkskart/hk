import { Worker } from "bullmq";
import { deliver, relayOutbox, type NotificationJob } from "@hkfinhub/notifications";
import { NOTIFICATION_QUEUE, type Container } from "./container";
import { Redis } from "ioredis";

/**
 * Background processing: relays outbox rows to the queue and delivers notification jobs.
 * Runs as its own process (npm run worker), so API latency is independent of provider latency.
 */
export function startNotificationWorker(c: Container, opts: { relayIntervalMs?: number } = {}) {
  const relayIntervalMs = opts.relayIntervalMs ?? 1000;
  const connection = new Redis(c.config.redisUrl, { maxRetriesPerRequest: null });
  const worker = new Worker<NotificationJob>(
    NOTIFICATION_QUEUE,
    async (job) => {
      const result = await deliver(job.data, {
        store: c.outbox,
        email: c.email,
        sms: c.sms,
        realtime: c.realtime,
        fieldKey: c.config.fieldKey,
      });
      return result;
    },
    { connection, concurrency: 5 },
  );
  worker.on("failed", (job, err) => c.logger.warn({ jobId: job?.id, err: err.message }, "notification delivery failed; will retry"));

  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const n = await relayOutbox(c.outbox, c.queue);
      if (n > 0) c.logger.info({ relayed: n }, "outbox relayed");
    } catch (err) {
      c.logger.error({ err }, "outbox relay failed");
    }
  };
  const timer = setInterval(() => void tick(), relayIntervalMs);

  return {
    async stop() {
      stopped = true;
      clearInterval(timer);
      await worker.close();
      await connection.quit();
    },
    tick,
  };
}
