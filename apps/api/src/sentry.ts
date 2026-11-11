import * as Sentry from "@sentry/node";
import type { ApiConfig } from "./config";

/** Error monitoring is optional: it starts only when a DSN is configured (decision D13). */
export function initSentry(config: ApiConfig): boolean {
  if (!config.sentryDsn) return false;
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.appEnv,
    tracesSampleRate: 0.1,
  });
  return true;
}
