/** Security policy constants. Changing these is a reviewed change, not a config flag. */
export const POLICY = {
  passwordMinLength: 12,
  passwordMaxLength: 128,
  otpTtlSeconds: 5 * 60,
  otpMaxAttempts: 5,
  otpSendsPerHour: 5,
  mfaChallengeTtlSeconds: 5 * 60,
  mfaMaxAttempts: 5,
  lockoutThreshold: 5,
  lockoutMinutes: 15,
  loginPerIpPer15Min: 30,
  loginPerAccountPer15Min: 10,
  passwordResetPerHourPerEmail: 5,
  refreshTtlSeconds: 30 * 24 * 60 * 60,
  accessTtlSeconds: 15 * 60,
  recoveryCodeCount: 10,
  totpWindowSteps: 1,
} as const;
