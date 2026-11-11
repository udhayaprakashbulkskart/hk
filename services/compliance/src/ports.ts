import type { LimitRule, LimitScope } from "./limits";
import type { TransferEvent } from "./rules";

export type KycTier = "BASIC" | "STANDARD" | "ENHANCED";
export type CaseKind = "SANCTIONS" | "VELOCITY" | "STRUCTURING" | "MANUAL_HOLD";
export type CaseStatus = "OPEN" | "CLEARED";
export type SubjectType = "USER" | "ACCOUNT" | "BENEFICIARY";

export interface ComplianceCaseRecord {
  id: string;
  kind: CaseKind;
  status: CaseStatus;
  severity: "LOW" | "MEDIUM" | "HIGH";
  blocking: boolean;
  subjectType: SubjectType;
  subjectId: string;
  accountId: string | null;
  detail: Record<string, unknown>;
  openedAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
}

export type NewCase = Omit<ComplianceCaseRecord, "id" | "status" | "openedAt" | "resolvedAt" | "resolvedBy" | "resolutionNote">;

export interface ApprovalRecord {
  id: string;
  action: "LIMIT_CHANGE";
  payload: Record<string, unknown>;
  requestedBy: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decidedBy: string | null;
  decidedAt: Date | null;
  createdAt: Date;
}

export interface StaffActor {
  id: string;
  role: "COMPLIANCE_ADMIN" | "SUPPORT_ADMIN" | "FINANCE_ADMIN" | "SUPER_ADMIN" | "CUSTOMER";
}

export interface ComplianceStore {
  recordScreening(r: { subjectType: SubjectType; subjectId: string; provider: string; hitCount: number; detail: Record<string, unknown> }): Promise<void>;
  openCase(c: NewCase): Promise<ComplianceCaseRecord>;
  /** Open, blocking cases on any of the given subjects. */
  findOpenBlocking(subjects: { subjectType: SubjectType; subjectId: string }[]): Promise<ComplianceCaseRecord | null>;
  /** Any open case of this kind on this subject, used to avoid duplicate alerts. */
  findOpenCase(kind: CaseKind, subject: { subjectType: SubjectType; subjectId: string }): Promise<ComplianceCaseRecord | null>;
  findCase(id: string): Promise<ComplianceCaseRecord | null>;
  /** Compare-and-set OPEN to CLEARED. */
  clearCase(id: string, resolvedBy: string, note: string, now: Date): Promise<boolean>;

  limitRules(tier: string): Promise<LimitRule[]>;
  setLimitRule(rule: LimitRule): Promise<void>;
  /** Sum of settled-or-pending outbound amounts for the account in the currency, optionally one corridor. */
  usedSince(p: { accountId: string; currency: string; since: Date; corridor: string | null }): Promise<bigint>;
  /** Outbound attempts in the given window, for velocity and structuring. */
  outboundEvents(accountId: string, since: Date): Promise<TransferEvent[]>;

  insertApproval(a: { action: "LIMIT_CHANGE"; payload: Record<string, unknown>; requestedBy: string }): Promise<ApprovalRecord>;
  findApproval(id: string): Promise<ApprovalRecord | null>;
  /** Compare-and-set PENDING to APPROVED or REJECTED. */
  decideApproval(id: string, to: "APPROVED" | "REJECTED", decidedBy: string, now: Date): Promise<boolean>;

  audit(entry: { actorUserId: string | null; action: string; subjectType: string; subjectId: string | null; metadata?: Record<string, unknown> }): Promise<void>;
}

/** Sanctions and watchlist screening. The contract, not the vendor (decision D2 covers vendor choice). */
export interface SanctionsScreener {
  readonly id: string;
  screen(q: { name: string; dateOfBirth: string | null; country: string }): Promise<{ hits: { list: string; score: number }[] }>;
}

export type OutboundGuardInput = {
  userId: string;
  accountId: string;
  beneficiaryId: string | null;
  corridor: string;
  currency: string;
  amountMinor: bigint;
};

/** What TransferService calls before it reserves any funds. Implemented by ComplianceService. */
export interface OutboundGuard {
  assertOutbound(input: OutboundGuardInput): Promise<void>;
}

export type { LimitRule, LimitScope };
