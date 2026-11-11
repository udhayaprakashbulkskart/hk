import { DuplicateAccountError, type AuthStore, type DeviceRecord, type MfaRecord, type NewUser, type OtpChannel, type OtpPurpose, type OtpRecord, type ProfileRecord, type RefreshRecord, type SessionRecord, type TotpRecord, type UserRecord, type UserStatus } from "@hkfinhub/authentication";
import type { Database } from "./client";
import { Prisma } from "./generated/prisma/client";

type Tx = Omit<Database, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

const P2002 = "P2002"; // unique constraint violation

function mapUser(u: {
  id: string; customerNumber: string; email: string; phoneE164: string; passwordHash: string; status: string;
  emailVerifiedAt: Date | null; phoneVerifiedAt: Date | null; failedLogins: number; lockedUntil: Date | null;
}): UserRecord {
  return { ...u, status: u.status as UserStatus };
}

/** Prisma implementation of the authentication AuthStore port. Every write runs in the caller's transaction. */
export class PrismaAuthStore implements AuthStore {
  constructor(private readonly db: Database | Tx) {}

  async transaction<T>(fn: (tx: AuthStore) => Promise<T>): Promise<T> {
    const d = this.db as Database;
    if (typeof d.$transaction !== "function") throw new Error("nested transactions are not used by the auth service");
    return d.$transaction((tx) => fn(new PrismaAuthStore(tx as unknown as Tx)), { isolationLevel: "ReadCommitted", maxWait: 5000, timeout: 10000 });
  }

  private get q(): Tx {
    return this.db as Tx;
  }

  async findUserByEmail(email: string) {
    const u = await this.q.user.findUnique({ where: { email } });
    return u ? mapUser(u) : null;
  }
  async findUserByPhone(phoneE164: string) {
    const u = await this.q.user.findUnique({ where: { phoneE164 } });
    return u ? mapUser(u) : null;
  }
  async findUserById(id: string) {
    const u = await this.q.user.findUnique({ where: { id } });
    return u ? mapUser(u) : null;
  }
  async createUser(input: NewUser): Promise<UserRecord> {
    try {
      const u = await this.q.user.create({
        data: {
          customerNumber: input.customerNumber,
          email: input.email,
          phoneE164: input.phoneE164,
          passwordHash: input.passwordHash,
          profile: { create: input.profile },
        },
      });
      return mapUser(u);
    } catch (err) {
      if (isUnique(err)) throw new DuplicateAccountError();
      throw err;
    }
  }
  async updateUser(id: string, patch: Parameters<AuthStore["updateUser"]>[1]) {
    await this.q.user.update({ where: { id }, data: patch as Prisma.UserUpdateInput });
  }
  async getProfile(userId: string): Promise<ProfileRecord | null> {
    return this.q.userProfile.findUnique({ where: { userId } });
  }
  async countUsers() {
    return this.q.user.count();
  }

  async createOtp(input: Parameters<AuthStore["createOtp"]>[0]) {
    const o = await this.q.otpChallenge.create({
      data: { userId: input.userId, channel: input.channel, purpose: input.purpose, destination: input.destination, codeHash: input.codeHash, maxAttempts: input.maxAttempts, expiresAt: input.expiresAt },
    });
    return o.id;
  }
  async findLatestOpenOtp(userId: string, purpose: OtpPurpose, destination: string): Promise<OtpRecord | null> {
    const o = await this.q.otpChallenge.findFirst({
      where: { userId, purpose, destination, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    return o ? { ...o, channel: o.channel as OtpChannel, purpose: o.purpose as OtpPurpose } : null;
  }
  async incrementOtpAttempts(id: string) {
    await this.q.otpChallenge.update({ where: { id }, data: { attempts: { increment: 1 } } });
  }
  async consumeOtp(id: string, now: Date) {
    const r = await this.q.otpChallenge.updateMany({ where: { id, consumedAt: null }, data: { consumedAt: now } });
    return r.count === 1;
  }
  async consumeOpenOtps(userId: string, purpose: OtpPurpose, now: Date) {
    await this.q.otpChallenge.updateMany({ where: { userId, purpose, consumedAt: null }, data: { consumedAt: now } });
  }

  async getTotp(userId: string): Promise<TotpRecord | null> {
    return this.q.totpFactor.findUnique({ where: { userId } });
  }
  async putPendingTotp(userId: string, secretEnc: string) {
    await this.q.totpFactor.upsert({
      where: { userId },
      create: { userId, secretEnc },
      update: { secretEnc, confirmedAt: null, lastUsedStep: null, createdAt: new Date() },
    });
  }
  async confirmTotp(userId: string, step: bigint, now: Date) {
    await this.q.totpFactor.update({ where: { userId }, data: { confirmedAt: now, lastUsedStep: step } });
  }
  async markTotpStep(userId: string, step: bigint) {
    await this.q.totpFactor.update({ where: { userId }, data: { lastUsedStep: step } });
  }
  async deleteTotp(userId: string) {
    await this.q.totpFactor.deleteMany({ where: { userId } });
  }
  async replaceRecoveryCodes(userId: string, codeHashes: string[]) {
    await this.q.recoveryCode.deleteMany({ where: { userId } });
    await this.q.recoveryCode.createMany({ data: codeHashes.map((codeHash) => ({ userId, codeHash })) });
  }
  async consumeRecoveryCode(userId: string, codeHash: string, now: Date) {
    const candidate = await this.q.recoveryCode.findFirst({ where: { userId, codeHash, usedAt: null } });
    if (!candidate) return false;
    const r = await this.q.recoveryCode.updateMany({ where: { id: candidate.id, usedAt: null }, data: { usedAt: now } });
    return r.count === 1;
  }
  async countUnusedRecoveryCodes(userId: string) {
    return this.q.recoveryCode.count({ where: { userId, usedAt: null } });
  }
  async deleteRecoveryCodes(userId: string) {
    await this.q.recoveryCode.deleteMany({ where: { userId } });
  }

  async createMfaChallenge(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    const c = await this.q.mfaChallenge.create({ data: input });
    return c.id;
  }
  async findMfaChallenge(tokenHash: string): Promise<MfaRecord | null> {
    const c = await this.q.mfaChallenge.findUnique({ where: { tokenHash } });
    return c ? { id: c.id, userId: c.userId, attempts: c.attempts, expiresAt: c.expiresAt, consumedAt: c.consumedAt } : null;
  }
  async incrementMfaAttempts(id: string) {
    await this.q.mfaChallenge.update({ where: { id }, data: { attempts: { increment: 1 } } });
  }
  async consumeMfaChallenge(id: string, now: Date) {
    const r = await this.q.mfaChallenge.updateMany({ where: { id, consumedAt: null }, data: { consumedAt: now } });
    return r.count === 1;
  }

  async findDevice(id: string, userId: string): Promise<DeviceRecord | null> {
    return this.q.device.findFirst({ where: { id, userId } });
  }
  async createDevice(input: { userId: string; name: string; platform: string; now: Date }): Promise<DeviceRecord> {
    return this.q.device.create({ data: { userId: input.userId, name: input.name, platform: input.platform, lastSeenAt: input.now } });
  }
  async touchDevice(id: string, name: string, now: Date) {
    await this.q.device.update({ where: { id }, data: { lastSeenAt: now, name } });
  }
  async listDevices(userId: string) {
    return this.q.device.findMany({ where: { userId }, orderBy: { lastSeenAt: "desc" } });
  }
  async revokeDevice(id: string, now: Date) {
    await this.q.device.update({ where: { id }, data: { revokedAt: now } });
  }

  async createSession(input: { userId: string; deviceId: string; expiresAt: Date; now: Date }): Promise<SessionRecord> {
    return this.q.session.create({
      data: { userId: input.userId, deviceId: input.deviceId, expiresAt: input.expiresAt, createdAt: input.now, lastUsedAt: input.now },
    });
  }
  async findSession(id: string): Promise<SessionRecord | null> {
    return this.q.session.findUnique({ where: { id } });
  }
  async touchSession(id: string, now: Date) {
    await this.q.session.update({ where: { id }, data: { lastUsedAt: now } });
  }
  async revokeSession(id: string, reason: string, now: Date) {
    await this.q.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now, revokeReason: reason } });
  }
  async revokeSessionsForUser(userId: string, reason: string, now: Date, exceptSessionId?: string) {
    await this.q.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}) },
      data: { revokedAt: now, revokeReason: reason },
    });
  }
  async revokeSessionsForDevice(deviceId: string, reason: string, now: Date) {
    await this.q.session.updateMany({ where: { deviceId, revokedAt: null }, data: { revokedAt: now, revokeReason: reason } });
  }
  async listSessionsForUser(userId: string): Promise<SessionRecord[]> {
    return this.q.session.findMany({ where: { userId }, orderBy: { lastUsedAt: "desc" } });
  }

  async createRefreshToken(input: { sessionId: string; tokenHash: string; expiresAt: Date }) {
    await this.q.refreshToken.create({ data: input });
  }
  async findRefreshToken(tokenHash: string): Promise<RefreshRecord | null> {
    return this.q.refreshToken.findUnique({ where: { tokenHash }, select: { id: true, sessionId: true, expiresAt: true, usedAt: true } });
  }
  async markRefreshUsed(id: string, now: Date) {
    const r = await this.q.refreshToken.updateMany({ where: { id, usedAt: null }, data: { usedAt: now } });
    return r.count === 1;
  }

  async addOutbox(event: Parameters<AuthStore["addOutbox"]>[0]) {
    await this.q.outboxEvent.create({
      data: { type: event.type, aggregateId: event.aggregateId, payload: event.payload as Prisma.InputJsonValue },
    });
  }
  async audit(entry: Parameters<AuthStore["audit"]>[0]) {
    await this.q.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        action: entry.action,
        subjectType: entry.subjectType,
        subjectId: entry.subjectId,
        ip: entry.ip,
        userAgent: entry.userAgent?.slice(0, 255) ?? null,
        ...(entry.metadata ? { metadata: entry.metadata as Prisma.InputJsonValue } : {}),
      },
    });
  }
}

function isUnique(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === P2002;
}
