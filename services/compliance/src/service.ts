import { ComplianceError } from "./errors";
import { applicableRules, checkLimit, limitError, windowStart, type LimitRule } from "./limits";
import { structuringDetected, velocityBreached, type StructuringPolicy, type VelocityPolicy } from "./rules";
import type { ComplianceStore, KycTier, OutboundGuard, OutboundGuardInput, SanctionsScreener, StaffActor } from "./ports";

export interface MonitoringPolicy {
  velocity: VelocityPolicy;
  structuring: StructuringPolicy;
}

export interface ComplianceDeps {
  store: ComplianceStore;
  screener: SanctionsScreener;
  /** Verified KYC tier, or null when the customer has not been verified. */
  kycTier: (userId: string) => Promise<KycTier | null>;
  policy: MonitoringPolicy;
  now?: () => Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class ComplianceService implements OutboundGuard {
  private readonly now: () => Date;
  constructor(private readonly d: ComplianceDeps) {
    this.now = d.now ?? (() => new Date());
  }

  /** Screens a user or beneficiary. A hit opens a blocking case that holds outbound money until cleared. */
  async screenSubject(input: {
    subjectType: "USER" | "BENEFICIARY";
    subjectId: string;
    accountId: string | null;
    name: string;
    dateOfBirth: string | null;
    country: string;
  }): Promise<{ hitCount: number; blocked: boolean }> {
    const result = await this.d.screener.screen({ name: input.name, dateOfBirth: input.dateOfBirth, country: input.country });
    const hitCount = result.hits.length;
    // Only list names and scores are stored. The screened name itself is not kept in the record.
    const detail = { hits: result.hits.map((h) => ({ list: h.list, score: h.score })) };
    await this.d.store.recordScreening({ subjectType: input.subjectType, subjectId: input.subjectId, provider: this.d.screener.id, hitCount, detail });
    if (hitCount > 0) {
      const existing = await this.d.store.findOpenCase("SANCTIONS", { subjectType: input.subjectType, subjectId: input.subjectId });
      if (!existing) {
        await this.d.store.openCase({
          kind: "SANCTIONS",
          severity: "HIGH",
          blocking: true,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          accountId: input.accountId,
          detail: { provider: this.d.screener.id, ...detail },
        });
      }
      await this.d.store.audit({ actorUserId: null, action: "sanctions_hit", subjectType: input.subjectType, subjectId: input.subjectId, metadata: { hitCount } });
    }
    return { hitCount, blocked: hitCount > 0 };
  }

  /**
   * Called before any outbound money reserves funds. Order matters: KYC, then holds, then limits.
   * Alerts are recorded here too. They do not stop the transfer, they queue it for review.
   */
  async assertOutbound(input: OutboundGuardInput): Promise<void> {
    const tier = await this.d.kycTier(input.userId);
    if (!tier) throw new ComplianceError("KYC_REQUIRED", "verify your identity before sending money");

    const hold = await this.d.store.findOpenBlocking([
      { subjectType: "USER", subjectId: input.userId },
      { subjectType: "ACCOUNT", subjectId: input.accountId },
      ...(input.beneficiaryId ? [{ subjectType: "BENEFICIARY" as const, subjectId: input.beneficiaryId }] : []),
    ]);
    if (hold) throw new ComplianceError("COMPLIANCE_HOLD", "this transfer is on hold while we complete a review. We will contact you.");

    await this.monitor(input);

    const now = this.now();
    const rules = applicableRules(await this.d.store.limitRules(tier), tier, input.corridor, input.currency);
    for (const rule of rules) {
      const used = await this.usedFor(rule, input, now);
      const breach = checkLimit(rule, used, input.amountMinor);
      if (breach) throw limitError(breach, input.currency);
    }
  }

  private async usedFor(rule: LimitRule, input: OutboundGuardInput, now: Date): Promise<bigint> {
    if (rule.scope === "PER_TX") return 0n;
    return this.d.store.usedSince({
      accountId: input.accountId,
      currency: input.currency,
      since: windowStart(rule.scope, now),
      corridor: rule.corridor === "*" ? null : rule.corridor,
    });
  }

  private async monitor(input: OutboundGuardInput): Promise<void> {
    const now = this.now();
    const longest = Math.max(this.d.policy.velocity.windowMs, this.d.policy.structuring.windowMs, DAY_MS);
    const events = await this.d.store.outboundEvents(input.accountId, new Date(now.getTime() - longest));
    const subject = { subjectType: "ACCOUNT" as const, subjectId: input.accountId };

    if (velocityBreached(events, now, this.d.policy.velocity)) {
      await this.alert("VELOCITY", subject, input, { windowMs: this.d.policy.velocity.windowMs, maxCount: this.d.policy.velocity.maxCount });
    }
    if (structuringDetected(events, now, this.d.policy.structuring)) {
      await this.alert("STRUCTURING", subject, input, { threshold: this.d.policy.structuring.threshold.toString() });
    }
  }

  private async alert(kind: "VELOCITY" | "STRUCTURING", subject: { subjectType: "ACCOUNT"; subjectId: string }, input: OutboundGuardInput, detail: Record<string, unknown>) {
    if (await this.d.store.findOpenCase(kind, subject)) return;
    await this.d.store.openCase({ kind, severity: "MEDIUM", blocking: false, ...subject, accountId: input.accountId, detail });
  }

  /** True when an open blocking case exists on the user. Used to hold an identity PASS for review. */
  async hasBlockingCase(userId: string): Promise<boolean> {
    return (await this.d.store.findOpenBlocking([{ subjectType: "USER", subjectId: userId }])) !== null;
  }

  /** Compliance staff clear a case with a written reason. Clearing lifts the hold for that subject. */
  async clearCase(actor: StaffActor, caseId: string, note: string): Promise<void> {
    if (actor.role !== "COMPLIANCE_ADMIN") throw new ComplianceError("FORBIDDEN", "only compliance staff can clear cases");
    if (note.trim().length < 10) throw new ComplianceError("INVALID_REQUEST", "give a note of at least 10 characters");
    const c = await this.d.store.findCase(caseId);
    if (!c) throw new ComplianceError("NOT_FOUND", "case not found");
    const ok = await this.d.store.clearCase(caseId, actor.id, note.trim(), this.now());
    if (!ok) throw new ComplianceError("INVALID_TRANSITION", "this case is already closed");
    await this.d.store.audit({ actorUserId: actor.id, action: "compliance_case_cleared", subjectType: c.subjectType, subjectId: c.subjectId, metadata: { caseId, kind: c.kind, note: note.trim() } });
  }

  /** A limit change is requested by one compliance admin and must be approved by a different one. */
  async requestLimitChange(actor: StaffActor, rule: LimitRule & { reason: string }): Promise<string> {
    if (actor.role !== "COMPLIANCE_ADMIN") throw new ComplianceError("FORBIDDEN", "only compliance staff can request limit changes");
    if (rule.reason.trim().length < 10) throw new ComplianceError("INVALID_REQUEST", "give a reason of at least 10 characters");
    if (rule.amountMinor <= 0n) throw new ComplianceError("INVALID_REQUEST", "the limit must be positive");
    const approval = await this.d.store.insertApproval({
      action: "LIMIT_CHANGE",
      requestedBy: actor.id,
      payload: { tier: rule.tier, corridor: rule.corridor, scope: rule.scope, currency: rule.currency, amountMinor: rule.amountMinor.toString(), reason: rule.reason.trim() },
    });
    await this.d.store.audit({ actorUserId: actor.id, action: "limit_change_requested", subjectType: "ApprovalRequest", subjectId: approval.id });
    return approval.id;
  }

  async decideLimitChange(actor: StaffActor, approvalId: string, decision: "APPROVED" | "REJECTED"): Promise<void> {
    if (actor.role !== "COMPLIANCE_ADMIN") throw new ComplianceError("FORBIDDEN", "only compliance staff can decide limit changes");
    const req = await this.d.store.findApproval(approvalId);
    if (!req) throw new ComplianceError("NOT_FOUND", "request not found");
    if (req.requestedBy === actor.id) throw new ComplianceError("FORBIDDEN", "a different approver is required");
    if (req.status !== "PENDING") throw new ComplianceError("INVALID_TRANSITION", "this request has already been decided");
    const ok = await this.d.store.decideApproval(approvalId, decision, actor.id, this.now());
    if (!ok) throw new ComplianceError("INVALID_TRANSITION", "this request has already been decided");
    if (decision === "APPROVED") {
      const p = req.payload as Record<string, string>;
      await this.d.store.setLimitRule({
        tier: p.tier!,
        corridor: p.corridor!,
        scope: p.scope as LimitRule["scope"],
        currency: p.currency!,
        amountMinor: BigInt(p.amountMinor!),
      });
    }
    await this.d.store.audit({ actorUserId: actor.id, action: `limit_change_${decision.toLowerCase()}`, subjectType: "ApprovalRequest", subjectId: approvalId });
  }
}
