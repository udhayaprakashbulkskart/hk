import type { StaffRole } from "./permissions";

export interface StaffRecord {
  userId: string;
  role: StaffRole;
  status: "ACTIVE" | "DISABLED";
  totpConfirmed: boolean;
}

export interface ApprovalRow {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  requestedBy: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decidedBy: string | null;
  createdAt: Date;
}

export interface IdentityCipher {
  panEnc: string | null;
  passportEnc: string | null;
  dateOfBirthEnc: string | null;
}

export interface AdminStore {
  staffFor(userId: string): Promise<StaffRecord | null>;
  upsertStaff(userId: string, role: StaffRole, createdBy: string): Promise<void>;
  identityCipher(userId: string): Promise<IdentityCipher | null>;
  userHasTotp(userId: string): Promise<boolean>;
  upsertProviderApproval(p: { providerId: string; environment: string; contractRef: string; approvedBy: string }): Promise<void>;
  createApproval(a: { action: string; payload: Record<string, unknown>; requestedBy: string }): Promise<ApprovalRow>;
  findApproval(id: string): Promise<ApprovalRow | null>;
  decideApproval(id: string, to: "APPROVED" | "REJECTED", decidedBy: string, now: Date): Promise<boolean>;
  listPendingApprovals(): Promise<ApprovalRow[]>;
  listUsers(limit: number): Promise<{ userId: string; customerNumber: string; email: string; status: string; createdAt: Date }[]>;
  listPayments(limit: number): Promise<{ id: string; direction: string; providerId: string; status: string; currency: string; amountMinor: bigint; createdAt: Date }[]>;
  listTransfers(limit: number): Promise<{ id: string; accountId: string; kind: string; status: string; sourceCurrency: string; sourceMinor: bigint; recipientCurrency: string; createdAt: Date }[]>;
  recentAudit(limit: number): Promise<{ id: string; actorUserId: string | null; action: string; subjectType: string; subjectId: string | null; createdAt: Date }[]>;
  audit(entry: { actorUserId: string | null; action: string; subjectType: string; subjectId: string | null; metadata?: Record<string, unknown> | undefined }): Promise<void>;
}
