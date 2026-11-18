import "server-only";
import { db } from "./db";
import { ApiError } from "./errors";

/**
 * Fixed-window rate limiter stored in Postgres so it works across serverless instances.
 * Throws 429 when `limit` hits are exceeded within `windowSec`.
 */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  // Escape hatch for automated test runs only; ignored in production builds.
  if (process.env.RATE_LIMIT_DISABLED === "true" && process.env.NODE_ENV !== "production") return;
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSec}))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" < now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < now() THEN now() + make_interval(secs => ${windowSec}) ELSE "RateLimit"."resetAt" END
    RETURNING "count"`;
  if ((rows[0]?.count ?? 0) > limit) throw new ApiError(429, "Too many attempts. Please wait a few minutes and try again.");
}
