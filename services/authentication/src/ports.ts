/**
 * Ports: everything the authentication domain needs from the outside world.
 * Implementations live in packages/database (persistence) and apps/api (infrastructure).
 * This module has no framework and no database imports.
 */

export type UserStatus = "PENDING_VERIFICATION" | "ACTIVE" | "LOCKED" | "SUSPENDED" | "CLOSED";
export type OtpChannel = "EMAIL" | "SMS";
export type OtpPurpose = "VERIFY_EMAIL" | "VERIFY_PHONE" | "PASSWORD_RESET";

export interface UserRecord {
  id: string;
  customerNumber: string;
  email: string;
  phoneE164: string;
  passwordHash: string;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  failedLogins: number;
  lockedUntil: Date | null;
}

export interface ProfileRecord {
  userId: string;
  fullName: string;
  countryCode: string;
  language: string;
  baseCurrency: string;
  timezone: string;
}

export interface NewUser {
  customerNumber: string;
  email: string;
  phoneE164: string;
  passwordHash: string;
  profile: Omit<ProfileRecord, "userId">;
}

export interface OtpRecord {
  id: string;
  userId: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
  destination: string;
  codeHash: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
}

export interface TotpRecord {
  userId: string;
  secretEnc: string;
  confirmedAt: Date | null;
  lastUsedStep: bigint | null;
}

export interface DeviceRecord {
  id: string;
  userId: string;
  name: string;
  platform: string;
  lastSeenAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface SessionRecord {
  id: string;
  userId: string;
  deviceId: string;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
}

export interface RefreshRecord {
  id: string;
  sessionId: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface MfaRecord {
  id: string;
  userId: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface OutboxRequest {
  type: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}

export interface AuditEntry {
  actorUserId: string | null;
  action: string;
  subjectType: string;
  subjectId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata?: Record<string, unknown>;
}

export interface AuthStore {
  transaction<T>(fn: (tx: AuthStore) => Promise<T>): Promise<T>;

  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserByPhone(phoneE164: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  createUser(input: NewUser): Promise<UserRecord>;
  updateUser(id: string, patch: Partial<Pick<UserRecord, "status" | "passwordHash" | "failedLogins" | "lockedUntil" | "emailVerifiedAt" | "phoneVerifiedAt">> & { passwordChangedAt?: Date }): Promise<void>;
  getProfile(userId: string): Promise<ProfileRecord | null>;
  countUsers(): Promise<number>;

  createOtp(input: Omit<OtpRecord, "id" | "attempts" | "maxAttempts"> & { maxAttempts: number }): Promise<string>;
  findLatestOpenOtp(userId: string, purpose: OtpPurpose, destination: string): Promise<OtpRecord | null>;
  incrementOtpAttempts(id: string): Promise<void>;
  consumeOtp(id: string, now: Date): Promise<boolean>;
  consumeOpenOtps(userId: string, purpose: OtpPurpose, now: Date): Promise<void>;

  getTotp(userId: string): Promise<TotpRecord | null>;
  putPendingTotp(userId: string, secretEnc: string): Promise<void>;
  confirmTotp(userId: string, step: bigint, now: Date): Promise<void>;
  markTotpStep(userId: string, step: bigint): Promise<void>;
  deleteTotp(userId: string): Promise<void>;
  replaceRecoveryCodes(userId: string, codeHashes: string[]): Promise<void>;
  consumeRecoveryCode(userId: string, codeHash: string, now: Date): Promise<boolean>;
  countUnusedRecoveryCodes(userId: string): Promise<number>;
  deleteRecoveryCodes(userId: string): Promise<void>;

  createMfaChallenge(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<string>;
  findMfaChallenge(tokenHash: string): Promise<MfaRecord | null>;
  incrementMfaAttempts(id: string): Promise<void>;
  consumeMfaChallenge(id: string, now: Date): Promise<boolean>;

  findDevice(id: string, userId: string): Promise<DeviceRecord | null>;
  createDevice(input: { userId: string; name: string; platform: string; now: Date }): Promise<DeviceRecord>;
  touchDevice(id: string, name: string, now: Date): Promise<void>;
  listDevices(userId: string): Promise<DeviceRecord[]>;
  revokeDevice(id: string, now: Date): Promise<void>;

  createSession(input: { userId: string; deviceId: string; expiresAt: Date; now: Date }): Promise<SessionRecord>;
  findSession(id: string): Promise<SessionRecord | null>;
  touchSession(id: string, now: Date): Promise<void>;
  revokeSession(id: string, reason: string, now: Date): Promise<void>;
  revokeSessionsForUser(userId: string, reason: string, now: Date, exceptSessionId?: string): Promise<void>;
  revokeSessionsForDevice(deviceId: string, reason: string, now: Date): Promise<void>;
  listSessionsForUser(userId: string): Promise<SessionRecord[]>;

  createRefreshToken(input: { sessionId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<RefreshRecord | null>;
  markRefreshUsed(id: string, now: Date): Promise<boolean>;

  addOutbox(event: OutboxRequest): Promise<void>;
  audit(entry: AuditEntry): Promise<void>;
}

export interface RateLimiter {
  /** Counts one hit against `key`. Allowed while the count is within `limit` per window. */
  hit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
}

export interface AuthClock {
  now(): Date;
}

export const systemClock: AuthClock = { now: () => new Date() };
