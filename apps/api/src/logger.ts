import pino from "pino";

/** Fields that must never reach logs. Matched by key name at any depth. */
export const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "*.password",
  "*.current",
  "*.next",
  "*.newPassword",
  "*.code",
  "*.recoveryCode",
  "*.refreshToken",
  "*.mfaToken",
  "*.accessToken",
  "*.codeEnc",
  "*.secret",
  "*.otpauthUri",
];

export function createLogger(level: string) {
  return pino({
    level,
    redact: { paths: REDACT_PATHS, censor: "[redacted]" },
    base: { service: "hkfinhub-api" },
  });
}

export type Logger = ReturnType<typeof createLogger>;
