/**
 * Domain errors. `code` is stable and safe to show to clients. `message` never reveals whether
 * an account exists, which field was wrong, or any secret.
 */
export type AuthErrorCode =
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_UNAVAILABLE"
  | "VERIFICATION_REQUIRED"
  | "RATE_LIMITED"
  | "OTP_INVALID"
  | "MFA_INVALID"
  | "MFA_CHALLENGE_INVALID"
  | "REFRESH_INVALID"
  | "SESSION_INVALID"
  | "PASSWORD_POLICY"
  | "PHONE_INVALID"
  | "TOTP_NOT_PENDING"
  | "TOTP_ALREADY_ENABLED"
  | "TOTP_NOT_ENABLED"
  | "NOT_FOUND";

export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export const GENERIC_CREDENTIALS = "The email, mobile number or password is incorrect.";
