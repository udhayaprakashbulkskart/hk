import { randomBytes } from "node:crypto";
import { AuthError, GENERIC_CREDENTIALS } from "./errors";
import { decryptField, encryptField, keyedDigest, normaliseRecoveryCode, randomRecoveryCode, randomSixDigitCode, randomToken, safeEqualHex } from "./crypto";
import { assertPasswordPolicy, dummyPasswordHash, hashPassword, verifyPassword } from "./passwords";
import { POLICY } from "./policy";
import { normaliseEmail, normalisePhone } from "./phone";
import { type AuthClock, type AuthStore, type DeviceRecord, type OtpChannel, type OtpPurpose, type OtpRecord, type RateLimiter, type UserRecord, systemClock } from "./ports";
import { signAccessToken, verifyAccessToken, type AccessClaims } from "./tokens";
import { checkTotp, newTotpSecret, totpUri } from "./totp";

export interface AuthConfig {
  accessTokenSecret: Uint8Array;
  /** Keyed-digest key for OTPs, refresh tokens, MFA tokens and recovery codes. */
  digestKey: Uint8Array;
  /** AES-256-GCM key for TOTP secrets and OTP delivery payloads. */
  fieldKey: Uint8Array;
  totpIssuer: string;
  defaultPhoneCountry?: "HK" | "IN" | "SG" | "US" | "GB" | "AE" | "CN" | "DE" | "FR" | "AU";
}

export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
}

export interface DeviceInput {
  id?: string | undefined;
  name: string;
  platform: "web" | "ios" | "android";
}

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresIn: number;
}

export type LoginResult =
  | { status: "mfa_required"; mfaToken: string; mfaTokenExpiresIn: number }
  | { status: "authenticated"; tokens: TokenPair; sessionId: string; deviceId: string };

export const ACCEPTED = { accepted: true } as const;

export class AuthService {
  constructor(
    private readonly store: AuthStore,
    private readonly limiter: RateLimiter,
    private readonly config: AuthConfig,
    private readonly clock: AuthClock = systemClock,
  ) {}

  // ---------------------------------------------------------------- registration

  /** Always answers the same way whether or not the email or phone is already registered. */
  async register(
    input: { email: string; phone: string; password: string; fullName: string; countryCode: string; language: string },
    ctx: RequestContext,
  ): Promise<typeof ACCEPTED> {
    const now = this.clock.now();
    const email = normaliseEmail(input.email);
    const phoneE164 = normalisePhone(input.phone, this.config.defaultPhoneCountry);
    assertPasswordPolicy(input.password, { email, name: input.fullName });

    const existing = (await this.store.findUserByEmail(email)) ?? (await this.store.findUserByPhone(phoneE164));
    if (existing) {
      // Tell the existing owner, rather than revealing to the requester that the account exists.
      await this.store.transaction(async (tx) => {
        await tx.addOutbox(this.notification(existing.id, "registration_attempted", { email }));
        await tx.audit({ actorUserId: existing.id, action: "register_duplicate", subjectType: "User", subjectId: existing.id, ...ctx });
      });
      return ACCEPTED;
    }

    const passwordHash = await hashPassword(input.password);
    try {
      await this.store.transaction(async (tx) => {
        const user = await tx.createUser({
          customerNumber: newCustomerNumber(),
          email,
          phoneE164,
          passwordHash,
          profile: { fullName: input.fullName.trim(), countryCode: input.countryCode, language: input.language, baseCurrency: "HKD", timezone: "Asia/Hong_Kong" },
        });
        await this.issueOtp(tx, user.id, "VERIFY_EMAIL", "EMAIL", email, now);
        await this.issueOtp(tx, user.id, "VERIFY_PHONE", "SMS", phoneE164, now);
        await tx.audit({ actorUserId: user.id, action: "register", subjectType: "User", subjectId: user.id, ...ctx });
      });
    } catch (err) {
      // A concurrent registration with the same details: answer the same way.
      if (err instanceof DuplicateAccountError) return ACCEPTED;
      throw err;
    }
    return ACCEPTED;
  }

  async resendOtp(input: { email: string; channel: OtpChannel }): Promise<typeof ACCEPTED> {
    const user = await this.store.findUserByEmail(normaliseEmail(input.email));
    const purpose: OtpPurpose = input.channel === "EMAIL" ? "VERIFY_EMAIL" : "VERIFY_PHONE";
    const pending = user && user.status === "PENDING_VERIFICATION" && !isVerified(user, input.channel);
    if (user && pending) {
      try {
        await this.store.transaction((tx) => this.issueOtp(tx, user.id, purpose, input.channel, destinationFor(user, input.channel), this.clock.now()));
      } catch (err) {
        if (!(err instanceof AuthError && err.code === "RATE_LIMITED")) throw err; // silent when throttled
      }
    }
    return ACCEPTED;
  }

  async verifyOtp(input: { email: string; channel: OtpChannel; code: string }, ctx: RequestContext): Promise<{ channel: OtpChannel; verified: true; accountActive: boolean }> {
    const now = this.clock.now();
    const user = await this.store.findUserByEmail(normaliseEmail(input.email));
    if (!user || user.status !== "PENDING_VERIFICATION" || isVerified(user, input.channel)) {
      throw new AuthError("OTP_INVALID", "That code is invalid or has expired.");
    }
    const purpose: OtpPurpose = input.channel === "EMAIL" ? "VERIFY_EMAIL" : "VERIFY_PHONE";
    await this.checkOtp(user.id, purpose, destinationFor(user, input.channel), input.code, now, ctx);

    let accountActive = false;
    await this.store.transaction(async (tx) => {
      const patch = input.channel === "EMAIL" ? { emailVerifiedAt: now } : { phoneVerifiedAt: now };
      const emailOk = input.channel === "EMAIL" || user.emailVerifiedAt !== null;
      const phoneOk = input.channel === "SMS" || user.phoneVerifiedAt !== null;
      accountActive = emailOk && phoneOk;
      await tx.updateUser(user.id, accountActive ? { ...patch, status: "ACTIVE" } : patch);
      if (accountActive) await tx.addOutbox(this.notification(user.id, "welcome", {}));
      await tx.audit({ actorUserId: user.id, action: `otp_verified_${input.channel.toLowerCase()}`, subjectType: "User", subjectId: user.id, ...ctx });
    });
    return { channel: input.channel, verified: true, accountActive };
  }

  // ---------------------------------------------------------------- login

  async login(input: { email: string; password: string; device: DeviceInput }, ctx: RequestContext): Promise<LoginResult> {
    const now = this.clock.now();
    const email = normaliseEmail(input.email);
    await this.throttle(`login:ip:${ctx.ip ?? "unknown"}`, POLICY.loginPerIpPer15Min, 900);
    await this.throttle(`login:acct:${email}`, POLICY.loginPerAccountPer15Min, 900);

    const user = await this.store.findUserByEmail(email);
    if (!user) {
      await verifyPassword(await dummyPasswordHash(), input.password);
      throw new AuthError("INVALID_CREDENTIALS", GENERIC_CREDENTIALS);
    }
    if (user.lockedUntil && user.lockedUntil > now) {
      await verifyPassword(await dummyPasswordHash(), input.password);
      throw new AuthError("INVALID_CREDENTIALS", GENERIC_CREDENTIALS);
    }

    const ok = await verifyPassword(user.passwordHash, input.password);
    if (!ok) {
      await this.store.transaction(async (tx) => {
        const failed = user.failedLogins + 1;
        const lock = failed >= POLICY.lockoutThreshold;
        const lockedUntil = lock ? new Date(now.getTime() + POLICY.lockoutMinutes * 60_000) : null;
        await tx.updateUser(user.id, { failedLogins: lock ? 0 : failed, lockedUntil });
        if (lock) await tx.addOutbox(this.notification(user.id, "account_locked", { minutes: POLICY.lockoutMinutes }));
        await tx.audit({ actorUserId: user.id, action: lock ? "login_locked" : "login_failed", subjectType: "User", subjectId: user.id, ...ctx });
      });
      throw new AuthError("INVALID_CREDENTIALS", GENERIC_CREDENTIALS);
    }

    if (user.status === "PENDING_VERIFICATION") {
      throw new AuthError("VERIFICATION_REQUIRED", "Verify your email and mobile number to continue.");
    }
    if (user.status !== "ACTIVE") {
      throw new AuthError("ACCOUNT_UNAVAILABLE", "This account is not available. Contact support.");
    }
    if (user.failedLogins > 0) await this.store.updateUser(user.id, { failedLogins: 0 });

    const totp = await this.store.getTotp(user.id);
    if (totp?.confirmedAt) {
      const mfaToken = randomToken();
      await this.store.createMfaChallenge({
        userId: user.id,
        tokenHash: keyedDigest(this.config.digestKey, "mfa", mfaToken),
        expiresAt: new Date(now.getTime() + POLICY.mfaChallengeTtlSeconds * 1000),
      });
      return { status: "mfa_required", mfaToken, mfaTokenExpiresIn: POLICY.mfaChallengeTtlSeconds };
    }
    return this.openSession(user, input.device, ctx, now);
  }

  async completeMfaLogin(
    input: { mfaToken: string; code?: string | undefined; recoveryCode?: string | undefined; device: DeviceInput },
    ctx: RequestContext,
  ): Promise<LoginResult> {
    const now = this.clock.now();
    const challenge = await this.store.findMfaChallenge(keyedDigest(this.config.digestKey, "mfa", input.mfaToken));
    if (!challenge || challenge.consumedAt || challenge.expiresAt <= now || challenge.attempts >= POLICY.mfaMaxAttempts) {
      throw new AuthError("MFA_CHALLENGE_INVALID", "Your sign-in has expired. Log in again.");
    }
    await this.store.incrementMfaAttempts(challenge.id);
    const user = await this.store.findUserById(challenge.userId);
    if (!user || user.status !== "ACTIVE") throw new AuthError("MFA_CHALLENGE_INVALID", "Your sign-in has expired. Log in again.");

    if (input.code) {
      const totp = await this.store.getTotp(user.id);
      if (!totp?.confirmedAt) throw new AuthError("MFA_INVALID", "That code is not valid.");
      const secret = decryptField(this.config.fieldKey, totp.secretEnc);
      const result = await checkTotp(secret, input.code, totp.lastUsedStep);
      if (!result.valid) {
        await this.audit(user.id, "mfa_failed", ctx);
        throw new AuthError("MFA_INVALID", "That code is not valid.");
      }
      await this.store.markTotpStep(user.id, result.step);
    } else if (input.recoveryCode) {
      const digest = keyedDigest(this.config.digestKey, "recovery", normaliseRecoveryCode(input.recoveryCode));
      const used = await this.store.consumeRecoveryCode(user.id, digest, now);
      if (!used) {
        await this.audit(user.id, "mfa_failed", ctx);
        throw new AuthError("MFA_INVALID", "That recovery code is not valid.");
      }
    } else {
      throw new AuthError("MFA_INVALID", "Enter your authenticator code or a recovery code.");
    }

    const consumed = await this.store.consumeMfaChallenge(challenge.id, now);
    if (!consumed) throw new AuthError("MFA_CHALLENGE_INVALID", "Your sign-in has expired. Log in again.");
    return this.openSession(user, input.device, ctx, now);
  }

  // ---------------------------------------------------------------- sessions

  /** Rotates the refresh token. Presenting an already-used token revokes the whole session. */
  async refresh(refreshToken: string, ctx: RequestContext): Promise<TokenPair & { sessionId: string }> {
    const now = this.clock.now();
    const record = await this.store.findRefreshToken(keyedDigest(this.config.digestKey, "refresh", refreshToken));
    if (!record || record.expiresAt <= now) throw new AuthError("REFRESH_INVALID", "Your session has ended. Please log in again.");
    const session = await this.store.findSession(record.sessionId);
    if (!session || session.revokedAt || session.expiresAt <= now) {
      throw new AuthError("REFRESH_INVALID", "Your session has ended. Please log in again.");
    }

    if (record.usedAt) {
      // Replay of a rotated token: assume the token leaked and end the session family.
      await this.store.transaction(async (tx) => {
        await tx.revokeSession(session.id, "refresh_reuse", now);
        await tx.addOutbox(this.notification(session.userId, "refresh_reuse", {}));
        await tx.audit({ actorUserId: session.userId, action: "refresh_reuse_detected", subjectType: "Session", subjectId: session.id, ...ctx });
      });
      throw new AuthError("REFRESH_INVALID", "Your session has ended. Please log in again.");
    }

    const next = randomToken();
    const claimed = await this.store.transaction(async (tx) => {
      const ok = await tx.markRefreshUsed(record.id, now);
      if (!ok) return false;
      await tx.createRefreshToken({ sessionId: session.id, tokenHash: keyedDigest(this.config.digestKey, "refresh", next), expiresAt: session.expiresAt });
      await tx.touchSession(session.id, now);
      return true;
    });
    if (!claimed) {
      // Lost a race with a concurrent refresh using the same token: treat as reuse.
      await this.store.revokeSession(session.id, "refresh_reuse", now);
      throw new AuthError("REFRESH_INVALID", "Your session has ended. Please log in again.");
    }

    const access = await this.issueAccess(session.userId, session.id, session.deviceId, now);
    return { ...access, refreshToken: next, refreshTokenExpiresIn: secondsUntil(session.expiresAt, now), sessionId: session.id };
  }

  async logout(claims: AccessClaims, ctx: RequestContext): Promise<void> {
    await this.store.transaction(async (tx) => {
      await tx.revokeSession(claims.sid, "logout", this.clock.now());
      await tx.audit({ actorUserId: claims.sub, action: "logout", subjectType: "Session", subjectId: claims.sid, ...ctx });
    });
  }

  /** Authenticates a bearer token. Ends in SESSION_INVALID if the session has been revoked or expired. */
  async authenticate(token: string): Promise<{ userId: string; sessionId: string; deviceId: string }> {
    const claims = await verifyAccessToken(this.config.accessTokenSecret, token);
    const now = this.clock.now();
    const session = await this.store.findSession(claims.sid);
    if (!session || session.userId !== claims.sub || session.revokedAt || session.expiresAt <= now) {
      throw new AuthError("SESSION_INVALID", "Your session has ended. Please log in again.");
    }
    const user = await this.store.findUserById(claims.sub);
    if (!user || user.status !== "ACTIVE") throw new AuthError("SESSION_INVALID", "Your session has ended. Please log in again.");
    return { userId: claims.sub, sessionId: claims.sid, deviceId: session.deviceId };
  }

  async listDevices(userId: string, currentSessionId: string) {
    const [devices, sessions] = await Promise.all([this.store.listDevices(userId), this.store.listSessionsForUser(userId)]);
    const now = this.clock.now();
    return devices
      .filter((d: DeviceRecord) => !d.revokedAt)
      .map((d) => {
        const active = sessions.filter((s) => s.deviceId === d.id && !s.revokedAt && s.expiresAt > now);
        const last = active.reduce<Date | null>((acc, s) => (acc === null || s.lastUsedAt > acc ? s.lastUsedAt : acc), null);
        return {
          id: d.id,
          name: d.name,
          platform: d.platform,
          lastActiveAt: (last ?? d.lastSeenAt).toISOString(),
          current: active.some((s) => s.id === currentSessionId),
        };
      });
  }

  async revokeDevice(userId: string, deviceId: string, ctx: RequestContext): Promise<void> {
    const now = this.clock.now();
    const device = await this.store.findDevice(deviceId, userId);
    if (!device || device.revokedAt) throw new AuthError("NOT_FOUND", "Device not found.");
    await this.store.transaction(async (tx) => {
      await tx.revokeSessionsForDevice(deviceId, "device_revoked", now);
      await tx.revokeDevice(deviceId, now);
      await tx.addOutbox(this.notification(userId, "device_revoked", { deviceName: device.name }));
      await tx.audit({ actorUserId: userId, action: "device_revoked", subjectType: "Device", subjectId: deviceId, ...ctx });
    });
  }

  // ---------------------------------------------------------------- passwords

  async changePassword(input: { userId: string; sessionId: string; current: string; next: string }, ctx: RequestContext): Promise<void> {
    const now = this.clock.now();
    const user = await this.store.findUserById(input.userId);
    if (!user) throw new AuthError("NOT_FOUND", "Account not found.");
    if (!(await verifyPassword(user.passwordHash, input.current))) {
      await this.audit(user.id, "password_change_failed", ctx);
      throw new AuthError("INVALID_CREDENTIALS", "Your current password is incorrect.");
    }
    assertPasswordPolicy(input.next, { email: user.email });
    const passwordHash = await hashPassword(input.next);
    await this.store.transaction(async (tx) => {
      await tx.updateUser(user.id, { passwordHash, passwordChangedAt: now });
      await tx.revokeSessionsForUser(user.id, "password_changed", now, input.sessionId);
      await tx.addOutbox(this.notification(user.id, "password_changed", {}));
      await tx.audit({ actorUserId: user.id, action: "password_changed", subjectType: "User", subjectId: user.id, ...ctx });
    });
  }

  /** Always answers the same way, so it cannot be used to discover registered emails. */
  async requestPasswordReset(email: string, ctx: RequestContext): Promise<typeof ACCEPTED> {
    const normalised = normaliseEmail(email);
    const user = await this.store.findUserByEmail(normalised);
    if (user && user.status === "ACTIVE") {
      try {
        await this.throttle(`pwreset:${normalised}`, POLICY.passwordResetPerHourPerEmail, 3600);
        await this.store.transaction((tx) => this.issueOtp(tx, user.id, "PASSWORD_RESET", "EMAIL", user.email, this.clock.now()));
        await this.audit(user.id, "password_reset_requested", ctx);
      } catch (err) {
        if (!(err instanceof AuthError && err.code === "RATE_LIMITED")) throw err;
      }
    }
    return ACCEPTED;
  }

  async confirmPasswordReset(input: { email: string; code: string; newPassword: string }, ctx: RequestContext): Promise<void> {
    const now = this.clock.now();
    const user = await this.store.findUserByEmail(normaliseEmail(input.email));
    if (!user || user.status !== "ACTIVE") throw new AuthError("OTP_INVALID", "That code is invalid or has expired.");
    // Check the password first, so a rejected password does not spend the one-time code.
    assertPasswordPolicy(input.newPassword, { email: user.email });
    await this.checkOtp(user.id, "PASSWORD_RESET", user.email, input.code, now, ctx);
    const passwordHash = await hashPassword(input.newPassword);
    await this.store.transaction(async (tx) => {
      await tx.updateUser(user.id, { passwordHash, passwordChangedAt: now, failedLogins: 0, lockedUntil: null });
      await tx.consumeOpenOtps(user.id, "PASSWORD_RESET", now);
      await tx.revokeSessionsForUser(user.id, "password_reset", now);
      await tx.addOutbox(this.notification(user.id, "password_reset", {}));
      await tx.audit({ actorUserId: user.id, action: "password_reset", subjectType: "User", subjectId: user.id, ...ctx });
    });
  }

  // ---------------------------------------------------------------- two-factor

  async enrollTotp(userId: string): Promise<{ secret: string; otpauthUri: string }> {
    const user = await this.requireUser(userId);
    const existing = await this.store.getTotp(userId);
    if (existing?.confirmedAt) throw new AuthError("TOTP_ALREADY_ENABLED", "Two-factor authentication is already on.");
    const secret = newTotpSecret();
    await this.store.putPendingTotp(userId, encryptField(this.config.fieldKey, secret));
    return { secret, otpauthUri: totpUri(this.config.totpIssuer, user.email, secret) };
  }

  async confirmTotp(userId: string, code: string, ctx: RequestContext): Promise<{ recoveryCodes: string[] }> {
    const now = this.clock.now();
    const totp = await this.store.getTotp(userId);
    if (!totp || totp.confirmedAt) throw new AuthError("TOTP_NOT_PENDING", "Start two-factor setup first.");
    const result = await checkTotp(decryptField(this.config.fieldKey, totp.secretEnc), code, null);
    if (!result.valid) throw new AuthError("MFA_INVALID", "That code is not valid. Check the time on your device and try again.");

    const codes = Array.from({ length: POLICY.recoveryCodeCount }, () => randomRecoveryCode());
    const hashes = codes.map((c) => keyedDigest(this.config.digestKey, "recovery", normaliseRecoveryCode(c)));
    await this.store.transaction(async (tx) => {
      await tx.confirmTotp(userId, result.step, now);
      await tx.replaceRecoveryCodes(userId, hashes);
      await tx.addOutbox(this.notification(userId, "totp_enabled", {}));
      await tx.audit({ actorUserId: userId, action: "totp_enabled", subjectType: "User", subjectId: userId, ...ctx });
    });
    return { recoveryCodes: codes };
  }

  async disableTotp(userId: string, code: string, ctx: RequestContext): Promise<void> {
    const totp = await this.store.getTotp(userId);
    if (!totp?.confirmedAt) throw new AuthError("TOTP_NOT_ENABLED", "Two-factor authentication is not on.");
    const result = await checkTotp(decryptField(this.config.fieldKey, totp.secretEnc), code, totp.lastUsedStep);
    if (!result.valid) throw new AuthError("MFA_INVALID", "That code is not valid.");
    await this.store.transaction(async (tx) => {
      await tx.deleteTotp(userId);
      await tx.deleteRecoveryCodes(userId);
      await tx.addOutbox(this.notification(userId, "totp_disabled", {}));
      await tx.audit({ actorUserId: userId, action: "totp_disabled", subjectType: "User", subjectId: userId, ...ctx });
    });
  }

  async me(userId: string) {
    const user = await this.requireUser(userId);
    const profile = await this.store.getProfile(userId);
    const totp = await this.store.getTotp(userId);
    const recovery = totp?.confirmedAt ? await this.store.countUnusedRecoveryCodes(userId) : 0;
    return {
      id: user.id,
      customerNumber: user.customerNumber,
      email: user.email,
      phone: user.phoneE164,
      status: user.status,
      emailVerified: user.emailVerifiedAt !== null,
      phoneVerified: user.phoneVerifiedAt !== null,
      twoFactorEnabled: !!totp?.confirmedAt,
      recoveryCodesRemaining: recovery,
      profile: profile
        ? { fullName: profile.fullName, countryCode: profile.countryCode, language: profile.language, baseCurrency: profile.baseCurrency, timezone: profile.timezone }
        : null,
    };
  }

  // ---------------------------------------------------------------- internals

  private async openSession(user: UserRecord, device: DeviceInput, ctx: RequestContext, now: Date): Promise<LoginResult> {
    const refresh = randomToken();
    const result = await this.store.transaction(async (tx) => {
      const { device: dev, isNew } = await this.resolveDevice(tx, user.id, device, now);
      const session = await tx.createSession({ userId: user.id, deviceId: dev.id, expiresAt: new Date(now.getTime() + POLICY.refreshTtlSeconds * 1000), now });
      await tx.createRefreshToken({ sessionId: session.id, tokenHash: keyedDigest(this.config.digestKey, "refresh", refresh), expiresAt: session.expiresAt });
      if (isNew) {
        await tx.addOutbox(this.notification(user.id, "new_device", { deviceName: dev.name, platform: dev.platform }));
      }
      await tx.audit({ actorUserId: user.id, action: "login", subjectType: "Session", subjectId: session.id, ...ctx, metadata: { newDevice: isNew } });
      return { session, dev };
    });
    const access = await this.issueAccess(user.id, result.session.id, result.dev.id, now);
    return {
      status: "authenticated",
      sessionId: result.session.id,
      deviceId: result.dev.id,
      tokens: { ...access, refreshToken: refresh, refreshTokenExpiresIn: POLICY.refreshTtlSeconds },
    };
  }

  private async issueAccess(userId: string, sessionId: string, deviceId: string, now: Date) {
    const accessToken = await signAccessToken(this.config.accessTokenSecret, { sub: userId, sid: sessionId, did: deviceId }, POLICY.accessTtlSeconds, now);
    return { accessToken, accessTokenExpiresIn: POLICY.accessTtlSeconds };
  }

  private async resolveDevice(tx: AuthStore, userId: string, device: DeviceInput, now: Date): Promise<{ device: DeviceRecord; isNew: boolean }> {
    if (device.id) {
      const known = await tx.findDevice(device.id, userId);
      if (known && !known.revokedAt) {
        await tx.touchDevice(known.id, device.name, now);
        return { device: known, isNew: false };
      }
    }
    const created = await tx.createDevice({ userId, name: device.name, platform: device.platform, now });
    return { device: created, isNew: true };
  }

  private async issueOtp(tx: AuthStore, userId: string, purpose: OtpPurpose, channel: OtpChannel, destination: string, now: Date): Promise<void> {
    await this.throttle(`otp:${destination}`, POLICY.otpSendsPerHour, 3600);
    await tx.consumeOpenOtps(userId, purpose, now);
    const code = randomSixDigitCode();
    await tx.createOtp({
      userId,
      channel,
      purpose,
      destination,
      codeHash: this.otpDigest(userId, purpose, code),
      maxAttempts: POLICY.otpMaxAttempts,
      expiresAt: new Date(now.getTime() + POLICY.otpTtlSeconds * 1000),
    });
    await tx.addOutbox({
      type: "notification.requested",
      aggregateId: userId,
      payload: {
        template: "otp",
        userId,
        channel: channel === "EMAIL" ? "email" : "sms",
        destination,
        category: "security",
        // The plain code never reaches the outbox table. The worker decrypts it, sends it, and clears it.
        codeEnc: encryptField(this.config.fieldKey, code),
      },
    });
  }

  /** Verifies a code and spends one attempt. Throws OTP_INVALID for every failure mode. */
  private async checkOtp(userId: string, purpose: OtpPurpose, destination: string, code: string, now: Date, ctx: RequestContext): Promise<OtpRecord> {
    const otp = await this.store.findLatestOpenOtp(userId, purpose, destination);
    if (!otp || otp.expiresAt <= now) throw new AuthError("OTP_INVALID", "That code is invalid or has expired.");
    if (otp.attempts >= otp.maxAttempts) {
      await this.store.consumeOtp(otp.id, now);
      throw new AuthError("OTP_INVALID", "That code is invalid or has expired.");
    }
    await this.store.incrementOtpAttempts(otp.id);
    const digest = this.otpDigest(userId, purpose, code);
    if (!safeEqualHex(digest, otp.codeHash)) {
      await this.audit(userId, "otp_failed", ctx);
      throw new AuthError("OTP_INVALID", "That code is invalid or has expired.");
    }
    if (!(await this.store.consumeOtp(otp.id, now))) throw new AuthError("OTP_INVALID", "That code is invalid or has expired.");
    return otp;
  }

  private otpDigest(userId: string, purpose: OtpPurpose, code: string): string {
    return keyedDigest(this.config.digestKey, "otp", userId, purpose, code);
  }

  private async throttle(key: string, limit: number, windowSeconds: number): Promise<void> {
    const r = await this.limiter.hit(key, limit, windowSeconds);
    if (!r.allowed) throw new AuthError("RATE_LIMITED", "Too many attempts. Try again later.", r.retryAfterSeconds);
  }

  private async requireUser(userId: string): Promise<UserRecord> {
    const user = await this.store.findUserById(userId);
    if (!user) throw new AuthError("NOT_FOUND", "Account not found.");
    return user;
  }

  private async audit(userId: string, action: string, ctx: RequestContext): Promise<void> {
    await this.store.audit({ actorUserId: userId, action, subjectType: "User", subjectId: userId, ...ctx });
  }

  private notification(userId: string, template: string, data: Record<string, unknown>) {
    return { type: "notification.requested", aggregateId: userId, payload: { template, userId, category: "security", data } };
  }
}

export class DuplicateAccountError extends Error {
  constructor() {
    super("duplicate account");
    this.name = "DuplicateAccountError";
  }
}

function isVerified(user: UserRecord, channel: OtpChannel): boolean {
  return channel === "EMAIL" ? user.emailVerifiedAt !== null : user.phoneVerifiedAt !== null;
}

function destinationFor(user: UserRecord, channel: OtpChannel): string {
  return channel === "EMAIL" ? user.email : user.phoneE164;
}

function secondsUntil(date: Date, now: Date): number {
  return Math.max(0, Math.floor((date.getTime() - now.getTime()) / 1000));
}

/** CUS-style customer number: HKF + 8 Crockford-like characters. Unique in the database. */
export function newCustomerNumber(): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = randomBytes(8);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `HKF${out}`;
}
