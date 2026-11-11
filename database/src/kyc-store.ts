import type { IdentityRecord, KycFileRecord, KycRecord, KycStatus, KycStore } from "@hkfinhub/kyc";
import type { Database } from "./client";
import { Prisma } from "./generated/prisma/client";

type Tx = Omit<Database, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

function toRecord(r: { userId: string; status: string; tier: string; providerRef: string | null; rejectionReason: string | null; verifiedAt: Date | null }): KycRecord {
  return { userId: r.userId, status: r.status as KycStatus, tier: r.tier as KycRecord["tier"], providerRef: r.providerRef, rejectionReason: r.rejectionReason, verifiedAt: r.verifiedAt };
}

function toFile(f: { id: string; kind: string; storageKey: string; checksumSha256: string; sizeBytes: number; mimeType: string; wrappedKey: string; scanStatus: string; createdAt: Date; kycRecord: { userId: string } }): KycFileRecord {
  return {
    id: f.id,
    userId: f.kycRecord.userId,
    kind: f.kind as KycFileRecord["kind"],
    storageKey: f.storageKey,
    checksumSha256: f.checksumSha256,
    sizeBytes: f.sizeBytes,
    mimeType: f.mimeType,
    wrappedKey: f.wrappedKey,
    scanStatus: f.scanStatus as KycFileRecord["scanStatus"],
    createdAt: f.createdAt,
  };
}

export class PrismaKycStore implements KycStore {
  constructor(private readonly db: Database | Tx) {}
  private get q(): Tx {
    return this.db as Tx;
  }

  async transaction<T>(fn: (tx: KycStore) => Promise<T>): Promise<T> {
    return (this.db as Database).$transaction((tx) => fn(new PrismaKycStore(tx as unknown as Tx)), { isolationLevel: "ReadCommitted", timeout: 20000 });
  }

  async ensureRecord(userId: string): Promise<KycRecord> {
    const r = await this.q.kycRecord.upsert({
      where: { userId },
      create: { userId, status: "NOT_STARTED", tier: "BASIC" },
      update: {},
    });
    return toRecord(r);
  }

  async getRecord(userId: string) {
    const r = await this.q.kycRecord.findUnique({ where: { userId } });
    return r ? toRecord(r) : null;
  }

  async findByProviderRef(providerRef: string) {
    const r = await this.q.kycRecord.findFirst({ where: { providerRef } });
    return r ? toRecord(r) : null;
  }

  /** Compare-and-set: the update only applies if the status is still one of `from`. */
  async moveStatus(userId: string, from: KycStatus[], to: KycStatus, patch?: Partial<Pick<KycRecord, "providerRef" | "rejectionReason" | "tier" | "verifiedAt">>): Promise<boolean> {
    const res = await this.q.kycRecord.updateMany({
      where: { userId, status: { in: from } },
      data: { status: to, ...(patch ?? {}) },
    });
    return res.count === 1;
  }

  async getIdentity(userId: string): Promise<IdentityRecord | null> {
    const r = await this.q.kycIdentity.findUnique({ where: { userId } });
    return r ? { userId: r.userId, panEnc: r.panEnc, panMasked: r.panMasked, passportEnc: r.passportEnc, passportMasked: r.passportMasked, dateOfBirthEnc: r.dateOfBirthEnc, nationality: r.nationality } : null;
  }

  async upsertIdentity(i: IdentityRecord): Promise<void> {
    await this.q.kycIdentity.upsert({
      where: { userId: i.userId },
      create: { ...i },
      update: { panEnc: i.panEnc, panMasked: i.panMasked, passportEnc: i.passportEnc, passportMasked: i.passportMasked, dateOfBirthEnc: i.dateOfBirthEnc, nationality: i.nationality },
    });
  }

  async addFile(f: KycFileRecord): Promise<void> {
    const record = await this.ensureRecord(f.userId);
    const kycRecord = await this.q.kycRecord.findUniqueOrThrow({ where: { userId: record.userId } });
    await this.q.kycFile.create({
      data: {
        id: f.id,
        kycRecordId: kycRecord.id,
        kind: f.kind,
        storageKey: f.storageKey,
        checksumSha256: f.checksumSha256,
        sizeBytes: f.sizeBytes,
        mimeType: f.mimeType,
        wrappedKey: f.wrappedKey,
        scanStatus: f.scanStatus,
        createdAt: f.createdAt,
      },
    });
  }

  async listFiles(userId: string): Promise<KycFileRecord[]> {
    const rows = await this.q.kycFile.findMany({ where: { kycRecord: { userId } }, include: { kycRecord: true }, orderBy: { createdAt: "asc" } });
    return rows.map(toFile);
  }

  async getFile(id: string): Promise<KycFileRecord | null> {
    const f = await this.q.kycFile.findUnique({ where: { id }, include: { kycRecord: true } });
    return f ? toFile(f) : null;
  }

  async audit(e: { actorUserId: string | null; action: string; subjectType: string; subjectId: string | null; metadata?: Record<string, unknown> }): Promise<void> {
    await this.q.auditLog.create({
      data: { actorUserId: e.actorUserId, action: e.action, subjectType: e.subjectType, subjectId: e.subjectId, metadata: (e.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue },
    });
  }
}
