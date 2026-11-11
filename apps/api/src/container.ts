import { AuthService, type AuthConfig, type RateLimiter } from "@hkfinhub/authentication";
import { createDatabase, PrismaAuthStore, PrismaOutboxStore, type Database } from "@hkfinhub/database";
import { CaptureSender, UnconfiguredSender, RedisRealtimePublisher, type EmailSender, type JobQueue, type RealtimePublisher, type SmsSender } from "@hkfinhub/notifications";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { buildAccountingServices } from "./container-services";
import type { ApiConfig } from "./config";
import { createLogger, type Logger } from "./logger";

export const NOTIFICATION_QUEUE = "notifications";

export interface Container {
  config: ApiConfig;
  ledger: ReturnType<typeof buildAccountingServices>["ledger"];
  accounts: ReturnType<typeof buildAccountingServices>["accounts"];
  wallet: ReturnType<typeof buildAccountingServices>["wallet"];
  logger: Logger;
  db: Database;
  redis: Redis;
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
}

/** Redis-backed fixed-window limiter. One INCR per attempt, so it is cheap and safe across instances. */
export class RedisRateLimiter implements RateLimiter {
  constructor(private readonly redis: Redis, private readonly prefix = "rl:") {}

  async hit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const k = `${this.prefix}${key}`;
    const count = await this.redis.incr(k);
    if (count === 1) await this.redis.expire(k, windowSeconds);
    if (count <= limit) return { allowed: true, retryAfterSeconds: 0 };
    const ttl = await this.redis.ttl(k);
    return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : windowSeconds };
  }
}

export function createContainer(config: ApiConfig, overrides: ContainerOverrides = {}): Container {
  const logger = overrides.logger ?? createLogger(config.logLevel);
  const db = createDatabase(config.databaseUrl);
  const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 2, enableReadyCheck: true });
  const limiter = new RedisRateLimiter(redis);
  const authConfig: AuthConfig = {
    accessTokenSecret: config.accessTokenSecret,
    digestKey: config.digestKey,
    fieldKey: config.fieldKey,
    totpIssuer: config.totpIssuer,
    defaultPhoneCountry: "HK",
  };
  const auth = new AuthService(new PrismaAuthStore(db), limiter, authConfig);
  const outbox = new PrismaOutboxStore(db);
  const bullConnection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue(NOTIFICATION_QUEUE, { connection: bullConnection });
  const jobQueue: JobQueue = {
    add: async (jobId, data) => {
      await queue.add("deliver", data, {
        jobId,
        attempts: 8,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600 },
      });
    },
  };
  const realtime = new RedisRealtimePublisher(redis);
  const accounting = buildAccountingServices(db, config.fieldKey);

  const email: EmailSender = overrides.email ?? (config.emailProvider === "capture" ? new CaptureSender() : new UnconfiguredSender("email"));
  const sms: SmsSender = overrides.sms ?? (config.smsProvider === "capture" ? new CaptureSender() : new UnconfiguredSender("sms"));

  return {
    config,
    ledger: accounting.ledger,
    accounts: accounting.accounts,
    wallet: accounting.wallet,
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
      await queue.close();
      await bullConnection.quit();
      await redis.quit();
      await db.$disconnect();
    },
  };
}
