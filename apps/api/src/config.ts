import { z } from "zod";

const base64Key32 = z
  .string()
  .refine((v) => Buffer.from(v, "base64").length === 32, "must be base64 for exactly 32 bytes");

const schema = z.object({
  APP_ENV: z.enum(["local", "test", "sandbox", "staging", "production"]).default("local"),
  API_PORT: z.coerce.number().int().min(0).max(65535).default(4000), // 0 picks a free port (tests)
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(64, "must be at least 64 characters"),
  DIGEST_KEY: base64Key32,
  FIELD_ENCRYPTION_KEY: base64Key32,
  CORS_ORIGINS: z.string().default(""),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  OPENAPI_ENABLED: z.enum(["true", "false"]).default("true"),
  EMAIL_PROVIDER: z.enum(["none", "capture"]).default("none"),
  SMS_PROVIDER: z.enum(["none", "capture"]).default("none"),
  TOTP_ISSUER: z.string().default("HK FinHub"),
  SENTRY_DSN: z.string().optional(),
  PAYMENT_ENVIRONMENT: z.enum(["sandbox", "live"]).default("sandbox"),
  FEATURE_LIVE_PAYMENTS: z.enum(["true", "false"]).default("false"),
  FEATURE_LIVE_TRANSFERS: z.enum(["true", "false"]).default("false"),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAYX_ACCOUNT_NUMBER: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  ADYEN_API_KEY: z.string().optional(),
  ADYEN_HMAC_KEY: z.string().regex(/^[0-9a-fA-F]*$/).optional(),
  ADYEN_MERCHANT_ACCOUNT: z.string().optional(),
  PAYMENT_RETURN_URL: z.string().url().default("https://app.hkfinhub.example/payments/return"),
  ADMIN_ALLOWED_IPS: z.string().default(""),
  KYC_MASTER_KEY: z.string().optional(),
  KYC_WEBHOOK_SECRET: z.string().optional(),
  KYC_DOCUMENT_BUCKET: z.string().optional(),
  KMS_KEY_ID: z.string().optional(),
  AWS_REGION: z.string().default("ap-east-1"),
});

export interface ApiConfig {
  appEnv: "local" | "test" | "sandbox" | "staging" | "production";
  port: number;
  logLevel: string;
  databaseUrl: string;
  redisUrl: string;
  accessTokenSecret: Uint8Array;
  digestKey: Uint8Array;
  fieldKey: Uint8Array;
  corsOrigins: string[];
  trustProxyHops: number;
  openapiEnabled: boolean;
  emailProvider: "none" | "capture";
  smsProvider: "none" | "capture";
  totpIssuer: string;
  sentryDsn: string | undefined;
  paymentEnvironment: "sandbox" | "live";
  adminAllowedIps: string[];
  kyc: { masterKey: Buffer | undefined; webhookSecret: string | undefined; bucket: string | undefined; kmsKeyId: string | undefined; region: string };
  liveFeaturePayments: boolean;
  liveFeatureTransfers: boolean;
  providers: {
    razorpay?: { keyId: string; keySecret: string; webhookSecret: string };
    razorpayx?: { keyId: string; keySecret: string; webhookSecret: string; accountNumber: string };
    stripe?: { secretKey: string; webhookSecret: string };
    adyen?: { apiKey: string; hmacKeyHex: string; merchantAccount: string };
  };
  paymentReturnUrl: string;
}

/** Loads and validates configuration. Refuses to start with weak or contradictory settings. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid configuration: ${problems}`);
  }
  const e = parsed.data;
  if (e.APP_ENV === "production") {
    if (e.EMAIL_PROVIDER === "capture" || e.SMS_PROVIDER === "capture") {
      throw new Error("Invalid configuration: capture providers are not allowed in production");
    }
  }
  return {
    appEnv: e.APP_ENV,
    port: e.API_PORT,
    logLevel: e.LOG_LEVEL,
    databaseUrl: e.DATABASE_URL,
    redisUrl: e.REDIS_URL,
    accessTokenSecret: new TextEncoder().encode(e.JWT_ACCESS_SECRET),
    digestKey: Buffer.from(e.DIGEST_KEY, "base64"),
    fieldKey: Buffer.from(e.FIELD_ENCRYPTION_KEY, "base64"),
    corsOrigins: e.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
    trustProxyHops: e.TRUST_PROXY_HOPS,
    openapiEnabled: e.OPENAPI_ENABLED === "true",
    emailProvider: e.EMAIL_PROVIDER,
    smsProvider: e.SMS_PROVIDER,
    totpIssuer: e.TOTP_ISSUER,
    sentryDsn: e.SENTRY_DSN,
    paymentEnvironment: e.PAYMENT_ENVIRONMENT,
    liveFeaturePayments: e.FEATURE_LIVE_PAYMENTS === "true",
    liveFeatureTransfers: e.FEATURE_LIVE_TRANSFERS === "true",
    providers: {
      ...(e.RAZORPAY_KEY_ID && e.RAZORPAY_KEY_SECRET && e.RAZORPAY_WEBHOOK_SECRET
        ? { razorpay: { keyId: e.RAZORPAY_KEY_ID, keySecret: e.RAZORPAY_KEY_SECRET, webhookSecret: e.RAZORPAY_WEBHOOK_SECRET } }
        : {}),
      ...(e.RAZORPAY_KEY_ID && e.RAZORPAY_KEY_SECRET && e.RAZORPAY_WEBHOOK_SECRET && e.RAZORPAYX_ACCOUNT_NUMBER
        ? { razorpayx: { keyId: e.RAZORPAY_KEY_ID, keySecret: e.RAZORPAY_KEY_SECRET, webhookSecret: e.RAZORPAY_WEBHOOK_SECRET, accountNumber: e.RAZORPAYX_ACCOUNT_NUMBER } }
        : {}),
      ...(e.STRIPE_SECRET_KEY && e.STRIPE_WEBHOOK_SECRET ? { stripe: { secretKey: e.STRIPE_SECRET_KEY, webhookSecret: e.STRIPE_WEBHOOK_SECRET } } : {}),
      ...(e.ADYEN_API_KEY && e.ADYEN_HMAC_KEY && e.ADYEN_MERCHANT_ACCOUNT
        ? { adyen: { apiKey: e.ADYEN_API_KEY, hmacKeyHex: e.ADYEN_HMAC_KEY, merchantAccount: e.ADYEN_MERCHANT_ACCOUNT } }
        : {}),
    },
    paymentReturnUrl: e.PAYMENT_RETURN_URL,
    adminAllowedIps: e.ADMIN_ALLOWED_IPS.split(",").map((s) => s.trim()).filter(Boolean),
    kyc: {
      masterKey: e.KYC_MASTER_KEY ? Buffer.from(e.KYC_MASTER_KEY, "base64") : undefined,
      webhookSecret: e.KYC_WEBHOOK_SECRET,
      bucket: e.KYC_DOCUMENT_BUCKET,
      kmsKeyId: e.KMS_KEY_ID,
      region: e.AWS_REGION,
    },
  };
}
