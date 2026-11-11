import { decryptField } from "@hkfinhub/authentication";
import { AdminError } from "./errors";
import { hasPermission, type Permission, type StaffRole } from "./permissions";
import type { AdminStore, ApprovalRow } from "./ports";

export interface StaffActor {
  id: string;
  role: StaffRole;
}

/** Why a PII value is revealed. Every reveal records one of these. */
export const REVEAL_REASONS = ["CUSTOMER_REQUEST", "FRAUD_INVESTIGATION", "REGULATORY_REQUEST", "DISPUTE_RESOLUTION"] as const;
export type RevealReason = (typeof REVEAL_REASONS)[number];
export const REVEAL_FIELDS = ["PAN", "PASSPORT", "DATE_OF_BIRTH"] as const;
export type RevealField = (typeof REVEAL_FIELDS)[number];

export const PROVIDER_IDS = ["razorpay", "razorpayx", "stripe", "adyen", "upi_bank_partner", "intl_payout_partner", "ppi_partner"] as const;
export const ENVIRONMENTS = ["sandbox", "live"] as const;

export class AdminService {
  constructor(
    private readonly store: AdminStore,
    private readonly fieldKey: Uint8Array,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * The single permission gate. A denial is audited before the error is raised, so refused attempts are visible.
   */
  async require(actor: StaffActor, permission: Permission, subject?: { type: string; id: string | null }): Promise<void> {
    if (hasPermission(actor.role, permission)) return;
    await this.store.audit({
      actorUserId: actor.id,
      action: "admin_permission_denied",
      subjectType: subject?.type ?? "Admin",
      subjectId: subject?.id ?? null,
      metadata: { permission, role: actor.role },
    });
    throw new AdminError("FORBIDDEN", "your role does not allow this action");
  }

  /** Staff are stored with a role. Only SUPER_ADMIN can add or change them, and the staff member must have TOTP confirmed. */
  async setStaffRole(actor: StaffActor, userId: string, role: StaffRole): Promise<void> {
    await this.require(actor, "staff.manage", { type: "User", id: userId });
    if (!(await this.store.userHasTotp(userId))) throw new AdminError("INVALID_REQUEST", "staff must confirm two-factor authentication before a role is assigned");
    if (userId === actor.id) throw new AdminError("INVALID_REQUEST", "you cannot change your own staff role");
    await this.store.upsertStaff(userId, role, actor.id);
    await this.store.audit({ actorUserId: actor.id, action: "staff_role_set", subjectType: "User", subjectId: userId, metadata: { role } });
  }

  /** Requests a provider approval. Approving one is what the live-payment gate reads, so it needs a different approver. */
  async requestProviderApproval(actor: StaffActor, input: { providerId: string; environment: string; contractRef: string }): Promise<string> {
    await this.require(actor, "provider.config.request", { type: "Provider", id: input.providerId });
    if (!(PROVIDER_IDS as readonly string[]).includes(input.providerId)) throw new AdminError("INVALID_REQUEST", "unknown provider");
    if (!(ENVIRONMENTS as readonly string[]).includes(input.environment)) throw new AdminError("INVALID_REQUEST", "environment must be sandbox or live");
    if (input.contractRef.trim().length < 4) throw new AdminError("INVALID_REQUEST", "give the contract reference");
    const row = await this.store.createApproval({ action: "PROVIDER_CONFIG", payload: { ...input, contractRef: input.contractRef.trim() }, requestedBy: actor.id });
    await this.store.audit({ actorUserId: actor.id, action: "provider_approval_requested", subjectType: "ApprovalRequest", subjectId: row.id, metadata: { providerId: input.providerId, environment: input.environment } });
    return row.id;
  }

  async decideProviderApproval(actor: StaffActor, approvalId: string, decision: "APPROVED" | "REJECTED"): Promise<void> {
    await this.require(actor, "provider.config.approve", { type: "ApprovalRequest", id: approvalId });
    const req = await this.store.findApproval(approvalId);
    if (!req || req.action !== "PROVIDER_CONFIG") throw new AdminError("NOT_FOUND", "approval not found");
    if (req.requestedBy === actor.id) throw new AdminError("SELF_APPROVAL", "the person who requested a change cannot approve it");
    if (req.status !== "PENDING") throw new AdminError("APPROVAL_NOT_PENDING", "this request is no longer pending");
    const ok = await this.store.decideApproval(approvalId, decision, actor.id, this.now());
    if (!ok) throw new AdminError("APPROVAL_NOT_PENDING", "this request is no longer pending");
    if (decision === "APPROVED") {
      const p = req.payload as { providerId: string; environment: string; contractRef: string };
      await this.store.upsertProviderApproval({ providerId: p.providerId, environment: p.environment, contractRef: p.contractRef, approvedBy: actor.id });
    }
    await this.store.audit({ actorUserId: actor.id, action: `provider_approval_${decision.toLowerCase()}`, subjectType: "ApprovalRequest", subjectId: approvalId });
  }

  /**
   * Decrypts one identity field for a customer. The reason code is required and recorded with the audit row.
   * The audit row is written before the value is decrypted.
   */
  async revealPii(actor: StaffActor, userId: string, field: RevealField, reason: RevealReason): Promise<string | null> {
    await this.require(actor, "customers.pii.reveal", { type: "User", id: userId });
    if (!(REVEAL_REASONS as readonly string[]).includes(reason)) throw new AdminError("INVALID_REQUEST", "a valid reason code is required");
    const cipher = await this.store.identityCipher(userId);
    if (!cipher) throw new AdminError("NOT_FOUND", "no identity details for this customer");
    await this.store.audit({ actorUserId: actor.id, action: "pii_revealed", subjectType: "User", subjectId: userId, metadata: { field, reason } });
    const enc = field === "PAN" ? cipher.panEnc : field === "PASSPORT" ? cipher.passportEnc : cipher.dateOfBirthEnc;
    return enc ? decryptField(this.fieldKey, enc) : null;
  }

  pendingApprovals(): Promise<ApprovalRow[]> {
    return this.store.listPendingApprovals();
  }

  async recentAudit(actor: StaffActor, limit: number) {
    await this.require(actor, "audit.read", { type: "AuditLog", id: null });
    return this.store.recentAudit(limit);
  }
}
