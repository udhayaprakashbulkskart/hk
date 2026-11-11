/**
 * HTTP client for the customer authentication endpoints (apps/api, /v1/auth).
 * Used by web and mobile for sign-in, registration, verification and password reset.
 * Other domains still use the sandbox client until their endpoints exist.
 */

export interface DevicePayload {
  id?: string;
  name: string;
  platform: "web" | "ios" | "android";
}

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresIn: number;
}

export type LoginOutcome =
  | { status: "mfa_required"; mfaToken: string; mfaTokenExpiresIn: number }
  | { status: "authenticated"; tokens: TokenPair; sessionId: string; deviceId: string };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface AuthClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  requestId?: () => string;
}

export function createAuthClient(opts: AuthClientOptions) {
  const base = opts.baseUrl.replace(/\/+$/, "");
  const doFetch = opts.fetchImpl ?? fetch;

  async function call<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown, accessToken?: string): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json", "X-Request-Id": opts.requestId?.() ?? crypto.randomUUID() };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    let res: Response;
    try {
      const init: RequestInit = { method, headers };
      if (body !== undefined) init.body = JSON.stringify(body);
      res = await doFetch(`${base}/v1${path}`, init);
    } catch {
      throw new ApiError(0, "NETWORK", "We could not reach HK FinHub. Check your connection and try again.");
    }
    const text = await res.text();
    const json = text ? (safeJson(text) as Record<string, unknown> | null) : null;
    if (!res.ok) {
      const err = (json?.["error"] ?? {}) as { code?: string; message?: string; retryAfterSeconds?: number };
      const retry = Number(res.headers.get("Retry-After") ?? err.retryAfterSeconds ?? 0) || undefined;
      throw new ApiError(res.status, err.code ?? "HTTP_ERROR", err.message ?? "Something went wrong. Please try again.", retry);
    }
    return (json ?? {}) as T;
  }

  return {
    register: (input: { email: string; phone: string; password: string; fullName: string; countryCode: string; language: string }) =>
      call<{ accepted: true }>("POST", "/auth/register", input),
    resendOtp: (input: { email: string; channel: "EMAIL" | "SMS" }) => call<{ accepted: true }>("POST", "/auth/otp/resend", input),
    verifyOtp: (input: { email: string; channel: "EMAIL" | "SMS"; code: string }) =>
      call<{ verified: true; channel: "EMAIL" | "SMS"; accountActive: boolean }>("POST", "/auth/otp/verify", input),
    login: (input: { email: string; password: string; device: DevicePayload }) => call<LoginOutcome>("POST", "/auth/login", input),
    loginMfa: (input: { mfaToken: string; code?: string; recoveryCode?: string; device: DevicePayload }) =>
      call<LoginOutcome>("POST", "/auth/login/mfa", input),
    refresh: (refreshToken: string) => call<TokenPair & { sessionId: string }>("POST", "/auth/refresh", { refreshToken }),
    logout: (accessToken: string) => call<{ ok: true }>("POST", "/auth/logout", undefined, accessToken),
    me: (accessToken: string) => call<Record<string, unknown>>("GET", "/me", undefined, accessToken),
    requestPasswordReset: (email: string) => call<{ accepted: true }>("POST", "/auth/password/reset/request", { email }),
    confirmPasswordReset: (input: { email: string; code: string; newPassword: string }) =>
      call<{ ok: true }>("POST", "/auth/password/reset/confirm", input),
  };
}

export type AuthClient = ReturnType<typeof createAuthClient>;

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
