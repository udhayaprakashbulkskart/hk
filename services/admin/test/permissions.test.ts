import { describe, expect, it } from "vitest";
import { AdminService, PERMISSIONS, ROLES, ROLE_PERMISSIONS, hasPermission, type AdminStore, type ApprovalRow } from "../src";
import { randomBytes } from "node:crypto";
import { encryptField } from "@hkfinhub/authentication";

function memoryStore(): AdminStore & { audits: { action: string; metadata?: Record<string, unknown> | undefined }[]; approvals: ApprovalRow[]; cipher: Record<string, string | null> | null; providers: unknown[]; staff: Map<string, unknown> } {
  const audits: { action: string; metadata?: Record<string, unknown> | undefined }[] = [];
  const approvals: ApprovalRow[] = [];
  const providers: unknown[] = [];
  const staff = new Map<string, unknown>();
  const s = {
    audits, approvals, providers, staff,
    cipher: null as Record<string, string | null> | null,
    async staffFor() { return null; },
    async upsertStaff(userId: string, role: string) { staff.set(userId, role); },
    async userHasTotp() { return true; },
    async identityCipher() { return s.cipher as never; },
    async upsertProviderApproval(p: unknown) { providers.push(p); },
    async createApproval(a: { action: string; payload: Record<string, unknown>; requestedBy: string }) {
      const row: ApprovalRow = { id: `ap-${approvals.length + 1}`, action: a.action, payload: a.payload, requestedBy: a.requestedBy, status: "PENDING", decidedBy: null, createdAt: new Date() };
      approvals.push(row);
      return row;
    },
    async findApproval(id: string) { return approvals.find((a) => a.id === id) ?? null; },
    async decideApproval(id: string, to: "APPROVED" | "REJECTED", decidedBy: string) {
      const row = approvals.find((a) => a.id === id && a.status === "PENDING");
      if (!row) return false;
      row.status = to; row.decidedBy = decidedBy; return true;
    },
    async listPendingApprovals() { return approvals.filter((a) => a.status === "PENDING"); },
    async recentAudit() { return []; },
    async audit(e: { action: string; metadata?: Record<string, unknown> | undefined }) { audits.push({ action: e.action, metadata: e.metadata }); },
  };
  return s as never;
}

const KEY = randomBytes(32);

describe("permission matrix", () => {
  it("every role has only defined permissions", () => {
    for (const r of ROLES) for (const p of ROLE_PERMISSIONS[r]) expect(PERMISSIONS).toContain(p);
  });
  it("support cannot decide or reveal; compliance cannot approve provider config", () => {
    expect(hasPermission("SUPPORT_ADMIN", "kyc.decide")).toBe(false);
    expect(hasPermission("SUPPORT_ADMIN", "customers.pii.reveal")).toBe(false);
    expect(hasPermission("COMPLIANCE_ADMIN", "provider.config.approve")).toBe(false);
    expect(hasPermission("FINANCE_ADMIN", "compliance.clear")).toBe(false);
    expect(hasPermission("COMPLIANCE_ADMIN", "kyc.decide")).toBe(true);
  });
  it("an unknown role has no permissions", () => {
    expect(hasPermission("CUSTOMER", "kyc.read")).toBe(false);
  });
});

describe("AdminService", () => {
  it("a denied permission is audited and refused", async () => {
    const store = memoryStore();
    const svc = new AdminService(store, KEY);
    await expect(svc.revealPii({ id: "s1", role: "SUPPORT_ADMIN" }, "u1", "PAN", "DISPUTE_RESOLUTION")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(store.audits.map((a) => a.action)).toContain("admin_permission_denied");
  });

  it("reveal needs a valid reason and returns the decrypted value, after an audit row", async () => {
    const store = memoryStore();
    store.cipher = { panEnc: encryptField(KEY, "ABCDE1234F"), passportEnc: null, dateOfBirthEnc: null };
    const svc = new AdminService(store, KEY);
    await expect(svc.revealPii({ id: "c1", role: "COMPLIANCE_ADMIN" }, "u1", "PAN", "because" as never)).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    const value = await svc.revealPii({ id: "c1", role: "COMPLIANCE_ADMIN" }, "u1", "PAN", "FRAUD_INVESTIGATION");
    expect(value).toBe("ABCDE1234F");
    const reveal = store.audits.find((a) => a.action === "pii_revealed");
    expect(reveal?.metadata).toMatchObject({ field: "PAN", reason: "FRAUD_INVESTIGATION" });
  });

  it("refuses a provider approval approved by the person who requested it (maker-checker)", async () => {
    const store = memoryStore();
    const svc = new AdminService(store, KEY);
    const id = await svc.requestProviderApproval({ id: "sa1", role: "SUPER_ADMIN" }, { providerId: "stripe", environment: "live", contractRef: "CONTRACT-2026-01" });
    await expect(svc.decideProviderApproval({ id: "sa1", role: "SUPER_ADMIN" }, id, "APPROVED")).rejects.toMatchObject({ code: "SELF_APPROVAL" });
    expect(store.providers).toHaveLength(0);
    await svc.decideProviderApproval({ id: "sa2", role: "SUPER_ADMIN" }, id, "APPROVED");
    expect(store.providers).toHaveLength(1);
  });

  it("only SUPER_ADMIN may assign staff roles, and not to themselves", async () => {
    const store = memoryStore();
    const svc = new AdminService(store, KEY);
    await expect(svc.setStaffRole({ id: "c1", role: "COMPLIANCE_ADMIN" }, "u2", "SUPPORT_ADMIN")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(svc.setStaffRole({ id: "sa1", role: "SUPER_ADMIN" }, "sa1", "SUPPORT_ADMIN")).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await svc.setStaffRole({ id: "sa1", role: "SUPER_ADMIN" }, "u2", "SUPPORT_ADMIN");
    expect(store.staff.get("u2")).toBe("SUPPORT_ADMIN");
  });
});
