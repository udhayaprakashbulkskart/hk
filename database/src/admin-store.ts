import type { AdminStore, ApprovalRow, IdentityCipher, StaffRecord } from "@hkfinhub/admin";
import type { StaffRole } from "@hkfinhub/admin";
import type { Database } from "./client";
import { Prisma } from "./generated/prisma/client";

type Tx = Omit<Database, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

export class PrismaAdminStore implements AdminStore {
  constructor(private readonly db: Database | Tx) {}
  private get q(): Tx {
    return this.db as Tx;
  }

  async staffFor(userId: string): Promise<StaffRecord | null> {
    const s = await this.q.staffMember.findUnique({ where: { userId } });
    if (!s) return null;
    const totp = await this.q.totpFactor.findUnique({ where: { userId } });
    return { userId, role: s.role as StaffRole, status: s.status as StaffRecord["status"], totpConfirmed: Boolean(totp?.confirmedAt) };
  }

  async userHasTotp(userId: string): Promise<boolean> {
    const t = await this.q.totpFactor.findUnique({ where: { userId } });
    return Boolean(t?.confirmedAt);
  }

  async upsertStaff(userId: string, role: StaffRole, createdBy: string): Promise<void> {
    await this.q.staffMember.upsert({
      where: { userId },
      create: { userId, role, status: "ACTIVE", createdBy },
      update: { role, status: "ACTIVE" },
    });
  }

  async identityCipher(userId: string): Promise<IdentityCipher | null> {
    const r = await this.q.kycIdentity.findUnique({ where: { userId } });
    return r ? { panEnc: r.panEnc, passportEnc: r.passportEnc, dateOfBirthEnc: r.dateOfBirthEnc } : null;
  }

  async upsertProviderApproval(p: { providerId: string; environment: string; contractRef: string; approvedBy: string }): Promise<void> {
    await this.q.providerApproval.upsert({
      where: { providerId_environment: { providerId: p.providerId, environment: p.environment } },
      create: p,
      update: { contractRef: p.contractRef, approvedBy: p.approvedBy, approvedAt: new Date() },
    });
  }

  async createApproval(a: { action: string; payload: Record<string, unknown>; requestedBy: string }): Promise<ApprovalRow> {
    const r = await this.q.approvalRequest.create({ data: { action: a.action, payload: a.payload as Prisma.InputJsonValue, requestedBy: a.requestedBy } });
    return toApproval(r);
  }

  async findApproval(id: string): Promise<ApprovalRow | null> {
    const r = await this.q.approvalRequest.findUnique({ where: { id } });
    return r ? toApproval(r) : null;
  }

  async decideApproval(id: string, to: "APPROVED" | "REJECTED", decidedBy: string, now: Date): Promise<boolean> {
    const res = await this.q.approvalRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: to, decidedBy, decidedAt: now } });
    return res.count === 1;
  }

  async listPendingApprovals(): Promise<ApprovalRow[]> {
    const rows = await this.q.approvalRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 200 });
    return rows.map(toApproval);
  }

  async recentAudit(limit: number) {
    return this.q.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: limit, select: { id: true, actorUserId: true, action: true, subjectType: true, subjectId: true, createdAt: true } });
  }

  async audit(e: { actorUserId: string | null; action: string; subjectType: string; subjectId: string | null; metadata?: Record<string, unknown> | undefined }): Promise<void> {
    await this.q.auditLog.create({
      data: { actorUserId: e.actorUserId, action: e.action, subjectType: e.subjectType, subjectId: e.subjectId, metadata: (e.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue },
    });
  }
}

function toApproval(r: { id: string; action: string; payload: unknown; requestedBy: string; status: string; decidedBy: string | null; createdAt: Date }): ApprovalRow {
  return { id: r.id, action: r.action, payload: (r.payload ?? {}) as Record<string, unknown>, requestedBy: r.requestedBy, status: r.status as ApprovalRow["status"], decidedBy: r.decidedBy, createdAt: r.createdAt };
}
