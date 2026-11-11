import { AuthService, type AuthConfig, type RateLimiter } from "@hkfinhub/authentication";
import { createDatabase, PrismaAuthStore, PrismaOutboxStore, type Database } from "@hkfinhub/database";
import { CaptureSender, UnconfiguredSender, RedisRealtimePublisher, type EmailSender, type JobQueue, type RealtimePublisher, type SmsSender } from "@hkfinhub/notifications";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { buildAccountingServices } from "./container-services";
import { buildPaymentServices, type PaymentServices } from "./container-payments";
import { buildKycServices } from "./container-kyc";
import { buildAdminServices, type AdminServices } from "./container-admin";
import { buildInvestmentServices, type InvestmentServices } from "./container-investment";
import type { ComplianceService } from "@hkfinhub/compliance";
import type { KycService } from "@hkfinhub/kyc";
import type { ApiConfig } from "./config";
import { createLogger, type Logger } from "./logger";

export const NOTIFICATION_QUEUE = "notifications";

export interface Container {
  config: ApiConfig;
  ledger: ReturnType<typeof buildAccountingServices>["ledger"];
  accounts: ReturnType<typeof buildAccountingServices>["accounts"];
  wallet: ReturnType<typeof buildAccountingServices>["wallet"];
  payments: PaymentServices["payments"];
  fx: PaymentServices["fx"];
  transfers: PaymentServices["transfers"];
  requests: PaymentServices["requests"];
  kyc: KycService;
  compliance: ComplianceService;
  admin: AdminServices["admin"];
  adminStore: AdminServices["adminStore"];
  adjustments: AdminServices["adjustments"];
  investment: InvestmentServices["investment"];
  sandboxBroker: InvestmentServices["sandboxBroker"];
  logger: Logger;
  db: Database;
  redis: Redis | null;
  auth: AuthService;
  outbox: PrismaOutboxStore;
  limiter: RateLimiter;
  queue: JobQueue;
  realtime: RealtimePublisher;
  email: EmailSender;
  sms: SmsSender;
  close(): Promise<void>;
}

export interface ContainerOverrides {
  email?: EmailSender;
  sms?: SmsSender;
  logger?: Logger;
  /** Provider HTTP transport. Tests supply a fake; production uses fetch. */
  transport?: import("@hkfinhub/payments").HttpTransport;
}

/** Fixed-window limiter stored in Postgres. Each attempt is one upsert, so it is safe across instances. */
export class PostgresRateLimiter implements RateLimiter {
  constructor(private readonly db: Database) {}
  async hit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const now = new Date();
    const rows = await this.db.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${key}, 1, ${new Date(now.getTime() + windowSeconds * 1000)})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."resetAt" > ${now} THEN "RateLimit"."count" + 1 ELSE 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" > ${now} THEN "RateLimit"."resetAt" ELSE ${new Date(now.getTime() + windowSeconds * 1000)} END
      RETURNING "count", "resetAt"`;
    const row = rows[0]!;
    if (row.count <= limit) return { allowed: true, retryAfterSeconds: 0 };
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000)) };
  }
}

/** Publisher used when no Redis is configured: live updates are not delivered. */
const noRealtime: RealtimePublisher = { publish: async () => {} } as unknown as RealtimePublisher;

export function createContainer(config: ApiConfig, overrides: ContainerOverrides = {}): Container {
  const logger = overrides.logger ?? createLogger(config.logLevel);
  const db = createDatabase(config.databaseUrl);
  const redis: Redis | null = config.redisUrl ? new Redis(config.redisUrl, { maxRetriesPerRequest: 2, enableReadyCheck: true }) : null;
  const limiter = new PostgresRateLimiter(db);
  const authConfig: AuthConfig = {
    accessTokenSecret: config.accessTokenSecret,
    digestKey: config.digestKey,
    fieldKey: config.fieldKey,
    totpIssuer: config.totpIssuer,
    defaultPhoneCountry: "HK",
  };
  const auth = new AuthService(new PrismaAuthStore(db), limiter, authConfig);
  const outbox = new PrismaOutboxStore(db);
  const bullConnection = config.redisUrl ? new Redis(config.redisUrl, { maxRetriesPerRequest: null }) : null;
  const queue = bullConnection ? new Queue(NOTIFICATION_QUEUE, { connection: bullConnection }) : null;
  const jobQueue: JobQueue = {
    add: async (jobId, data) => {
      // Without Redis, notifications stay in the outbox table until a worker with Redis delivers them.
      if (!queue) return;
      await queue.add("deliver", data, {
        jobId,
        attempts: 8,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600 },
      });
    },
  };
  const realtime = redis ? new RedisRealtimePublisher(redis) : noRealtime;
  const accounting = buildAccountingServices(db, config.fieldKey);
  const kycServices = buildKycServices(db, config);
  const adminServices = buildAdminServices(db, config.fieldKey, accounting.ledger);
  const investmentServices = buildInvestmentServices({ db, config, ledger: accounting.ledger, accounts: accounting.accounts, kyc: kycServices.kyc });
  const payments = buildPaymentServices({ db, config, ledger: accounting.ledger, accounts: accounting.accounts, transport: overrides.transport, guard: kycServices.compliance });

  const email: EmailSender = overrides.email ?? (config.emailProvider === "capture" ? new CaptureSender() : new UnconfiguredSender("email"));
  const sms: SmsSender = overrides.sms ?? (config.smsProvider === "capture" ? new CaptureSender() : new UnconfiguredSender("sms"));

  return {
    config,
    ledger: accounting.ledger,
    accounts: accounting.accounts,
    wallet: accounting.wallet,
    payments: payments.payments,
    fx: payments.fx,
    transfers: payments.transfers,
    requests: payments.requests,
    kyc: kycServices.kyc,
    compliance: kycServices.compliance,
    admin: adminServices.admin,
    adminStore: adminServices.adminStore,
    adjustments: adminServices.adjustments,
    investment: investmentServices.investment,
    sandboxBroker: investmentServices.sandboxBroker,
    logger,
    db,
    redis,
    auth,
    outbox,
    limiter,
    queue: jobQueue,
    realtime,
    email,
    sms,
    async close() {
      await queue?.close();
      await bullConnection?.quit();
      await redis?.quit();
      await db.$disconnect();
    },
  };
}
