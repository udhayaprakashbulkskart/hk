import { AuthError, type AuthErrorCode } from "@hkfinhub/authentication";
import { HttpException } from "@nestjs/common";

const STATUS: Record<AuthErrorCode, number> = {
  INVALID_CREDENTIALS: 401,
  ACCOUNT_UNAVAILABLE: 403,
  VERIFICATION_REQUIRED: 403,
  RATE_LIMITED: 429,
  OTP_INVALID: 400,
  MFA_INVALID: 401,
  MFA_CHALLENGE_INVALID: 401,
  REFRESH_INVALID: 401,
  SESSION_INVALID: 401,
  PASSWORD_POLICY: 422,
  PHONE_INVALID: 422,
  TOTP_NOT_PENDING: 409,
  TOTP_ALREADY_ENABLED: 409,
  TOTP_NOT_ENABLED: 409,
  NOT_FOUND: 404,
};

/** Maps a domain error to an HTTP exception with a stable error body. */
export function toHttp(err: AuthError): HttpException {
  return new HttpException(
    { code: err.code, message: err.message, ...(err.retryAfterSeconds !== undefined ? { retryAfterSeconds: err.retryAfterSeconds } : {}) },
    STATUS[err.code],
  );
}
