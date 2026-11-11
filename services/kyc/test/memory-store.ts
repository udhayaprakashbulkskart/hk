import type { IdentityRecord, KycFileRecord, KycRecord, KycStatus, KycStore } from "../src/ports";

/** In-memory KycStore for unit tests. Mirrors the compare-and-set semantics of the Prisma store. */
export function createMemoryKycStore(): KycStore & { auditLog: { action: string; actorUserId: string | null; subjectId: string | null }[]; tamper(id: string, patch: Partial<KycFileRecord>): void } {
  const records = new Map<string, KycRecord>();
  const identities = new Map<string, IdentityRecord>();
  const files = new Map<string, KycFileRecord>();
  const auditLog: { action: string; actorUserId: string | null; subjectId: string | null }[] = [];

  const store: KycStore & { auditLog: typeof auditLog; tamper(id: string, patch: Partial<KycFileRecord>): void } = {
    auditLog,
    tamper(id, patch) {
      const f = files.get(id);
      if (f) files.set(id, { ...f, ...patch });
    },
    async transaction(fn) {
      return fn(store);
    },
    async ensureRecord(userId) {
      let r = records.get(userId);
      if (!r) {
        r = { userId, status: "NOT_STARTED", tier: "BASIC", providerRef: null, rejectionReason: null, verifiedAt: null };
        records.set(userId, r);
      }
      return { ...r };
    },
    async getRecord(userId) {
      const r = records.get(userId);
      return r ? { ...r } : null;
    },
    async findByProviderRef(ref) {
      const r = [...records.values()].find((x) => x.providerRef === ref);
      return r ? { ...r } : null;
    },
    async moveStatus(userId, from, to, patch) {
      const r = records.get(userId);
      if (!r || !from.includes(r.status as KycStatus)) return false;
      records.set(userId, { ...r, ...patch, status: to });
      return true;
    },
    async getIdentity(userId) {
      const i = identities.get(userId);
      return i ? { ...i } : null;
    },
    async upsertIdentity(i) {
      identities.set(i.userId, { ...i });
    },
    async addFile(f) {
      files.set(f.id, { ...f });
    },
    async listFiles(userId) {
      return [...files.values()].filter((f) => f.userId === userId);
    },
    async getFile(id) {
      const f = files.get(id);
      return f ? { ...f } : null;
    },
    async audit(e) {
      auditLog.push({ action: e.action, actorUserId: e.actorUserId, subjectId: e.subjectId });
    },
  };
  return store;
}
