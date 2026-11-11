import { ApiError, createAuthClient, type DevicePayload, type TokenPair } from "@hkfinhub/api-client";

/** Base URL of the customer API. Set NEXT_PUBLIC_API_URL per environment. Must be in the API's CORS_ORIGINS. */
export const authClient = createAuthClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
});

export const WEB_DEVICE: DevicePayload = { name: "Web browser", platform: "web" };

/**
 * Tokens live in memory only. A page reload ends the session, which is the safe default until
 * refresh tokens move to httpOnly cookies on a same-site API domain (see docs/architecture.md).
 */
let session: { accessToken: string; refreshToken: string; expiresAt: number } | null = null;

export function setSession(tokens: TokenPair): void {
  session = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.accessTokenExpiresIn * 1000,
  };
}

export function getSession() {
  return session;
}

export function clearSession(): void {
  session = null;
}

/** Maps API errors to user-facing text. Codes are stable; wording never reveals account existence. */
export function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "RATE_LIMITED") return `Too many attempts. Try again in ${Math.ceil((err.retryAfterSeconds ?? 60) / 60)} minute(s).`;
    if (err.code === "VERIFICATION_REQUIRED") return "This account is not active. Contact the HK FinHub team for help.";
    if (err.code === "ACCOUNT_UNAVAILABLE") return "This account is not available. Contact support.";
    if (err.code === "PASSWORD_POLICY" || err.code === "PHONE_INVALID" || err.code === "OTP_INVALID" || err.code === "MFA_INVALID") return err.message;
    return err.message;
  }
  return "Something went wrong. Please try again.";
}
