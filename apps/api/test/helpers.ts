import { relayOutbox, deliver, CaptureSender, type JobQueue } from "@hkfinhub/notifications";
import { loadConfig, type ApiConfig } from "../src/config";
import { createContainer, type Container } from "../src/container";
import { createApp } from "../src/app";
import { createLogger } from "../src/logger";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { randomBytes } from "node:crypto";

/** Test-only secrets. Generated per run so nothing sensitive is ever committed. */
export function testEnv(): NodeJS.ProcessEnv {
  return {
    APP_ENV: "test",
    LOG_LEVEL: "silent",
    DATABASE_URL: process.env["TEST_DATABASE_URL"] ?? "postgresql://hkfinhub:hkfinhub-local@localhost:5432/hkfinhub_test",
    REDIS_URL: process.env["TEST_REDIS_URL"] ?? "redis://:hkf-test-redis@localhost:6379/15",
    JWT_ACCESS_SECRET: "test-access-secret-".padEnd(80, "x"),
    DIGEST_KEY: randomBytes(32).toString("base64"),
    FIELD_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    EMAIL_PROVIDER: "capture",
    SMS_PROVIDER: "capture",
    CORS_ORIGINS: "http://localhost:3000",
    API_PORT: "0",
  };
}

export interface TestApp {
  app: NestExpressApplication;
  container: Container;
  config: ApiConfig;
  email: CaptureSender;
  sms: CaptureSender;
  /** Delivers every pending notification now, inline. Mirrors the worker without needing BullMQ. */
  drain(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Test queue: records jobs during the relay transaction, then delivers them after it commits.
 * Delivering inside the relay transaction would deadlock on the outbox rows the relay has locked,
 * so the order here matches production: claim and enqueue, commit, then the worker delivers.
 */
export function collectingQueue(): { queue: JobQueue; jobs: { id: string; data: import("@hkfinhub/notifications").NotificationJob }[] } {
  const jobs: { id: string; data: import("@hkfinhub/notifications").NotificationJob }[] = [];
  return { queue: { add: async (id, data) => { jobs.push({ id, data }); } }, jobs };
}

/** Starts the real Nest application against the test database and Redis. */
export async function startTestApp(overrides: { logger?: boolean } = {}): Promise<TestApp> {
  const env = testEnv();
  const config = loadConfig(env);
  const email = new CaptureSender();
  const sms = new CaptureSender();
  const logger = createLogger(overrides.logger ? "info" : "silent");
  const container = createContainer(config, { email, sms, logger });
  const app = await createApp(container);
  await app.init();
  await app.listen(0, "127.0.0.1");
  const drain = async () => {
    for (let i = 0; i < 5; i++) {
      const { queue, jobs } = collectingQueue();
      const n = await relayOutbox(container.outbox, queue);
      for (const job of jobs) {
        await deliver(job.data, { store: container.outbox, email, sms, realtime: container.realtime, fieldKey: container.config.fieldKey });
      }
      if (n === 0) break;
    }
  };
  return {
    app,
    container,
    config,
    email,
    sms,
    drain,
    async close() {
      await app.close();
      await container.close();
    },
  };
}

/** Clean slate: empties every table and the test Redis database. Only ever points at the test database. */
export async function resetState(t: TestApp): Promise<void> {
  if (!t.config.databaseUrl.includes("_test")) throw new Error("refusing to reset a non-test database");
  await t.container.db.$executeRawUnsafe(`TRUNCATE "User","UserProfile","Device","Session","RefreshToken","OtpChallenge","TotpFactor","RecoveryCode","MfaChallenge","OutboxEvent","Notification","AuditLog" RESTART IDENTITY CASCADE`);
  await t.container.redis.flushdb();
}

/** Extracts the one-time code from the most recent message to an address. */
export function codeSentTo(capture: CaptureSender, to: string): string {
  const msg = [...capture.sent].reverse().find((m) => m.to === to);
  if (!msg) throw new Error(`no message sent to ${to}`);
  const match = msg.text.match(/\b(\d{6})\b/);
  if (!match) throw new Error("no code found in message");
  return match[1]!;
}

export const PASSWORD = "correct-horse-battery-9";
export const DEVICE = { name: "Test browser", platform: "web" as const };
