import { z } from "zod";

const base64Key32 = z
  .string()
  .refine((v) => Buffer.from(v, "base64").length === 32, "must be base64 for exactly 32 bytes");

const schema = z.object({
  APP_ENV: z.enum(["local", "test", "staging", "production"]).default("local"),
  API_PORT: z.coerce.number().int().min(0).max(65535).default(4000), // 0 picks a free port (tests)
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(64, "must be at least 64 characters"),
  DIGEST_KEY: base64Key32,
  FIELD_ENCRYPTION_KEY: base64Key32,
  CORS_ORIGINS: z.string().default(""),
  /** Optional pattern for origins that change per deployment, such as Vercel preview addresses. Anchored by the operator. */
  CORS_ORIGIN_PATTERN: z.string().optional(),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  OPENAPI_ENABLED: z.enum(["true", "false"]).default("true"),
  EMAIL_PROVIDER: z.enum(["none", "capture"]).default("none"),
  SMS_PROVIDER: z.enum(["none", "capture"]).default("none"),
  TOTP_ISSUER: z.string().default("HK FinHub"),
  SENTRY_DSN: z.string().optional(),
  PAYMENT_ENVIRONMENT: z.enum(["test", "live"]).default("test"),
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
  LOGIN_USER_USERNAME: z.string().optional(),
  LOGIN_USER_EMAIL: z.string().optional(),
  LOGIN_USER_PHONE: z.string().optional(),
  LOGIN_USER_PASSWORD: z.string().optional(),
  LOGIN_USER_NAME: z.string().optional(),
  RECEIVING_ACCOUNT_NAME: z.string().optional(),
  RECEIVING_ACCOUNT_NUMBER: z.string().optional(),
  RECEIVING_BANK_NAME: z.string().optional(),
  KYC_MASTER_KEY: z.string().optional(),
  KYC_WEBHOOK_SECRET: z.string().optional(),
  KYC_DOCUMENT_BUCKET: z.string().optional(),
  KMS_KEY_ID: z.string().optional(),
  AWS_REGION: z.string().default("ap-east-1"),
});

export interface ApiConfig {
  /** The operator's own receiving account. Read from environment only; never committed. Null when unset. */
  receivingAccount: { accountName: string; accountNumber: string; bankName: string } | null;
  appEnv: "local" | "test" | "staging" | "production";
  port: number;
  logLevel: string;
  databaseUrl: string;
  /** Optional. Without it, live updates and the notification queue are off; login and everything else still work. */
  redisUrl: string | undefined;
  accessTokenSecret: Uint8Array;
  digestKey: Uint8Array;
  fieldKey: Uint8Array;
  corsOrigins: string[];
  corsOriginPattern: RegExp | undefined;
  trustProxyHops: number;
  openapiEnabled: boolean;
  emailProvider: "none" | "capture";
  smsProvider: "none" | "capture";
  totpIssuer: string;
  sentryDsn: string | undefined;
  paymentEnvironment: "test" | "live";
  adminAllowedIps: string[];
  /** The single operator login. Created at startup from configuration; there is no customer signup. */
  loginUser: { email: string; phone: string; password: string; fullName: string } | undefined;
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
    redisUrl: e.REDIS_URL && e.REDIS_URL.length > 0 ? e.REDIS_URL : undefined,
    accessTokenSecret: new TextEncoder().encode(e.JWT_ACCESS_SECRET),
    digestKey: Buffer.from(e.DIGEST_KEY, "base64"),
    fieldKey: Buffer.from(e.FIELD_ENCRYPTION_KEY, "base64"),
    corsOrigins: e.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
    corsOriginPattern: e.CORS_ORIGIN_PATTERN ? new RegExp(e.CORS_ORIGIN_PATTERN) : undefined,
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
    loginUser: loginUserFrom(e),
    receivingAccount: e.RECEIVING_ACCOUNT_NUMBER
      ? { accountName: e.RECEIVING_ACCOUNT_NAME ?? "", accountNumber: e.RECEIVING_ACCOUNT_NUMBER, bankName: e.RECEIVING_BANK_NAME ?? "" }
      : null,
    kyc: {
      masterKey: e.KYC_MASTER_KEY ? Buffer.from(e.KYC_MASTER_KEY, "base64") : undefined,
      webhookSecret: e.KYC_WEBHOOK_SECRET,
      bucket: e.KYC_DOCUMENT_BUCKET,
      kmsKeyId: e.KMS_KEY_ID,
      region: e.AWS_REGION,
    },
  };
}

/**
 * The operator login. Password is required. The sign-in name defaults to LOGIN_USER_USERNAME (pubgadmin), which maps
 * to an internal address. The phone number is needed by the account model; if it is not given, a placeholder is used
 * and must be replaced before any SMS feature is used.
 */
function loginUserFrom(e: z.infer<typeof schema>): ApiConfig["loginUser"] {
  if (!e.LOGIN_USER_PASSWORD) return undefined;
  const username = (e.LOGIN_USER_USERNAME ?? "pubgadmin").trim().toLowerCase();
  return {
    email: e.LOGIN_USER_EMAIL && e.LOGIN_USER_EMAIL.length > 0 ? e.LOGIN_USER_EMAIL : `${username}@login.hkfinhub.internal`,
    phone: e.LOGIN_USER_PHONE && e.LOGIN_USER_PHONE.length > 0 ? e.LOGIN_USER_PHONE : "+85255550123",
    password: e.LOGIN_USER_PASSWORD,
    fullName: e.LOGIN_USER_NAME ?? "Operator",
  };
}
