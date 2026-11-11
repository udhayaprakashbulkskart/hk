import type { ApprovalRecord, CaseKind, ComplianceCaseRecord, ComplianceStore, NewCase, SubjectType } from "@hkfinhub/compliance";
import type { LimitRule } from "@hkfinhub/compliance";
import type { Database } from "./client";
import { Prisma } from "./generated/prisma/client";

type Tx = Omit<Database, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

function toCase(c: {
  id: string; kind: string; status: string; severity: string; blocking: boolean; subjectType: string; subjectId: string; accountId: string | null;
  detail: unknown; openedAt: Date; resolvedAt: Date | null; resolvedBy: string | null; resolutionNote: string | null;
}): ComplianceCaseRecord {
  return { ...c, kind: c.kind as CaseKind, status: c.status as "OPEN" | "CLEARED", severity: c.severity as ComplianceCaseRecord["severity"], subjectType: c.subjectType as SubjectType, detail: (c.detail ?? {}) as Record<string, unknown> };
}

function toApproval(a: { id: string; action: string; payload: unknown; requestedBy: string; status: string; decidedBy: string | null; decidedAt: Date | null; createdAt: Date }): ApprovalRecord {
  return { ...a, action: a.action as "LIMIT_CHANGE", status: a.status as ApprovalRecord["status"], payload: (a.payload ?? {}) as Record<string, unknown> };
}

const LIVE_STATUS = { not: "FAILED" } as const;

export class PrismaComplianceStore implements ComplianceStore {
  constructor(private readonly db: Database | Tx) {}
  private get q(): Tx {
    return this.db as Tx;
  }

  async recordScreening(r: { subjectType: SubjectType; subjectId: string; provider: string; hitCount: number; detail: Record<string, unknown> }): Promise<void> {
    await this.q.screeningResult.create({ data: { subjectType: r.subjectType, subjectId: r.subjectId, provider: r.provider, hitCount: r.hitCount, detail: r.detail as Prisma.InputJsonValue } });
  }

  async openCase(c: NewCase): Promise<ComplianceCaseRecord> {
    const row = await this.q.complianceCase.create({
      data: {
        kind: c.kind,
        status: "OPEN",
        severity: c.severity,
        blocking: c.blocking,
        subjectType: c.subjectType,
        subjectId: c.subjectId,
        accountId: c.accountId,
        detail: c.detail as Prisma.InputJsonValue,
      },
    });
    return toCase(row);
  }

  async findOpenBlocking(subjects: { subjectType: SubjectType; subjectId: string }[]) {
    const row = await this.q.complianceCase.findFirst({
      where: { status: "OPEN", blocking: true, OR: subjects.map((s) => ({ subjectType: s.subjectType, subjectId: s.subjectId })) },
    });
    return row ? toCase(row) : null;
  }

  async findOpenCase(kind: CaseKind, subject: { subjectType: SubjectType; subjectId: string }) {
    const row = await this.q.complianceCase.findFirst({ where: { status: "OPEN", kind, subjectType: subject.subjectType, subjectId: subject.subjectId } });
    return row ? toCase(row) : null;
  }

  async findCase(id: string) {
    const row = await this.q.complianceCase.findUnique({ where: { id } });
    return row ? toCase(row) : null;
  }

  /** Compare-and-set OPEN to CLEARED. Clearing lifts the blocking flag too. */
  async clearCase(id: string, resolvedBy: string, note: string, now: Date): Promise<boolean> {
    const res = await this.q.complianceCase.updateMany({
      where: { id, status: "OPEN" },
      data: { status: "CLEARED", blocking: false, resolvedAt: now, resolvedBy, resolutionNote: note.slice(0, 500) },
    });
    return res.count === 1;
  }

  async limitRules(tier: string): Promise<LimitRule[]> {
    const rows = await this.q.limitRule.findMany({ where: { tier } });
    return rows.map((r) => ({ tier: r.tier, corridor: r.corridor, scope: r.scope as LimitRule["scope"], currency: r.currency, amountMinor: r.amountMinor }));
  }

  async setLimitRule(rule: LimitRule): Promise<void> {
    await this.q.limitRule.upsert({
      where: { tier_corridor_scope_currency: { tier: rule.tier, corridor: rule.corridor, scope: rule.scope, currency: rule.currency } },
      create: { ...rule },
      update: { amountMinor: rule.amountMinor },
    });
  }

  /** Outbound money in the window. Failed transfers are excluded: no money moved. */
  async usedSince(p: { accountId: string; currency: string; since: Date; corridor: string | null }): Promise<bigint> {
    const agg = await this.q.transfer.aggregate({
      _sum: { sourceMinor: true },
      where: {
        accountId: p.accountId,
        sourceCurrency: p.currency,
        status: LIVE_STATUS,
        createdAt: { gte: p.since },
        ...(p.corridor ? { country: p.corridor } : {}),
      },
    });
    return agg._sum.sourceMinor ?? 0n;
  }

  async outboundEvents(accountId: string, since: Date) {
    const rows = await this.q.transfer.findMany({
      where: { accountId, status: LIVE_STATUS, createdAt: { gte: since } },
      select: { createdAt: true, sourceMinor: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({ at: r.createdAt, amountMinor: r.sourceMinor }));
  }

  async insertApproval(a: { action: "LIMIT_CHANGE"; payload: Record<string, unknown>; requestedBy: string }): Promise<ApprovalRecord> {
    const row = await this.q.approvalRequest.create({ data: { action: a.action, payload: a.payload as Prisma.InputJsonValue, requestedBy: a.requestedBy } });
    return toApproval(row);
  }

  async findApproval(id: string) {
    const row = await this.q.approvalRequest.findUnique({ where: { id } });
    return row ? toApproval(row) : null;
  }

  /** Compare-and-set PENDING to APPROVED or REJECTED. */
  async decideApproval(id: string, to: "APPROVED" | "REJECTED", decidedBy: string, now: Date): Promise<boolean> {
    const res = await this.q.approvalRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: to, decidedBy, decidedAt: now } });
    return res.count === 1;
  }

  async audit(e: { actorUserId: string | null; action: string; subjectType: string; subjectId: string | null; metadata?: Record<string, unknown> }): Promise<void> {
    await this.q.auditLog.create({
      data: { actorUserId: e.actorUserId, action: e.action, subjectType: e.subjectType, subjectId: e.subjectId, metadata: (e.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue },
    });
  }
}
