import { createTestBroker, createTestFxProvider, createTestKycProvider, createTestScanner, createTestScreener } from "./doubles";
import { createMemoryObjectStore } from "@hkfinhub/object-storage";
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
    PAYMENT_ENVIRONMENT: "test",
    FEATURE_LIVE_PAYMENTS: "false",
    FEATURE_LIVE_TRANSFERS: "false",
    RAZORPAY_KEY_ID: "rzp_test_fake",
    RAZORPAY_KEY_SECRET: "fake-razorpay-secret",
    RAZORPAY_WEBHOOK_SECRET: "whsec_razorpay_test",
    RAZORPAYX_ACCOUNT_NUMBER: "2323230000000001",
    STRIPE_SECRET_KEY: "sk_test_fake",
    STRIPE_WEBHOOK_SECRET: "whsec_stripe_test",
    ADYEN_API_KEY: "AQE-test-fake",
    ADYEN_HMAC_KEY: "44782DEF547AAA06C910C43932B1EB0C71FC68D9D0C057550C48EC2ACF6BA056",
    ADYEN_MERCHANT_ACCOUNT: "HKFinHubTest",
    KYC_MASTER_KEY: randomBytes(32).toString("base64"),
    KYC_WEBHOOK_SECRET: "test-kyc-webhook-secret",
  };
}

export interface TestApp {
  app: NestExpressApplication;
  container: Container;
  config: ApiConfig;
  email: CaptureSender;
  sms: CaptureSender;
  /** The simulated broker the tests drive. Test only. */
  broker: ReturnType<typeof createTestBroker>;
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
export async function startTestApp(overrides: { logger?: boolean; transport?: import("@hkfinhub/payments").HttpTransport } = {}): Promise<TestApp> {
  const env = testEnv();
  const config = loadConfig(env);
  const email = new CaptureSender();
  const sms = new CaptureSender();
  const logger = createLogger(overrides.logger ? "info" : "silent");
  // Simulated providers for tests only. See test/test. The runtime container never receives these.
  const broker = createTestBroker();
  const testDoubles = {
    fxProvider: createTestFxProvider(),
    kyc: { scanner: createTestScanner(), provider: createTestKycProvider(), screener: createTestScreener(), storage: createMemoryObjectStore() },
    investmentBroker: broker,
  };
  const container = createContainer(config, { email, sms, logger, testDoubles, ...(overrides.transport ? { transport: overrides.transport } : {}) });
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
    broker,
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
  await t.container.db.$executeRawUnsafe(`TRUNCATE "User","UserProfile","Device","Session","RefreshToken","OtpChallenge","TotpFactor","RecoveryCode","MfaChallenge","OutboxEvent","Notification","AuditLog","Account","CurrencyAccount","Beneficiary","LedgerEntry","LedgerBalance","LedgerTransaction","ReconciliationRecord","ApprovalRequest","LedgerAccount","Payment","ProviderWebhook","FxQuote","Transfer","PaymentRequest","ProviderApproval","KycRecord","KycIdentity","ComplianceCase","ScreeningResult","StaffMember","InvestmentFill","InvestmentOrder","RateLimit" RESTART IDENTITY CASCADE`);
  await t.container.redis?.flushdb();
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

/** Creates an active customer through the operator provisioning path. Tests use this in place of signup. */
export async function provisionActive(t: TestApp, who: { email: string; phone: string; name: string }): Promise<string> {
  const r = await t.container.auth.provisionLoginUser({ email: who.email, phone: who.phone, password: PASSWORD, fullName: who.name, countryCode: "HK", language: "en" });
  return r.userId;
}
