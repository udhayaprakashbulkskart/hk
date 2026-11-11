import request from "supertest";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS, type Permission, type StaffRole } from "@hkfinhub/admin";
import { startTestApp, resetState, type TestApp } from "./helpers";
import { createFakeProviders } from "./provider-fake";
import { authed, registerCustomer, type Customer } from "./support";

let t: TestApp;
const http = () => request(t.app.getHttpServer());
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("scan")]);

beforeAll(async () => {
  t = await startTestApp({ transport: createFakeProviders().transport });
});
afterAll(async () => { await t.close(); });
beforeEach(async () => { await resetState(t); });

/** Creates a customer who has confirmed TOTP, and assigns a staff role. Returns the session. */
async function staff(role: StaffRole, name = `staff-${role.toLowerCase()}-${randomUUID().slice(0, 6)}`): Promise<Customer> {
  const c = await registerCustomer(t, name);
  await t.container.db.totpFactor.create({ data: { userId: c.userId, secretEnc: "test-secret", confirmedAt: new Date() } });
  await t.container.db.staffMember.create({ data: { userId: c.userId, role, status: "ACTIVE", createdBy: "test-seed" } });
  return c;
}

const ids = { u: "00000000-0000-7000-8000-000000000001", f: "00000000-0000-7000-8000-000000000002", a: "00000000-0000-7000-8000-000000000003" };

/** Every admin endpoint, the permission it needs, and a plausible body. */
const ENDPOINTS: { name: string; method: "get" | "post"; path: string; permission: Permission; body?: unknown }[] = [
  { name: "customer summary", method: "get", path: `/v1/admin/customers/${ids.u}`, permission: "customers.read" },
  { name: "kyc status", method: "get", path: `/v1/admin/kyc/${ids.u}`, permission: "kyc.read" },
  { name: "kyc decision", method: "post", path: `/v1/admin/kyc/${ids.u}/decision`, permission: "kyc.decide", body: { decision: "REQUEST_INFO", reason: "need a clearer scan" } },
  { name: "document read", method: "get", path: `/v1/admin/kyc/documents/${ids.f}?reason=identity%20check%20for%20review`, permission: "kyc.document.read" },
  { name: "compliance queue", method: "get", path: "/v1/admin/compliance/cases", permission: "compliance.read" },
  { name: "clear case", method: "post", path: `/v1/admin/compliance/cases/${ids.u}/clear`, permission: "compliance.clear", body: { note: "reviewed and cleared" } },
  { name: "limit request", method: "post", path: "/v1/admin/limits/changes", permission: "limits.request", body: { tier: "STANDARD", corridor: "IN", scope: "DAILY", currency: "HKD", amountMinor: "2500000", reason: "approved by policy review" } },
  { name: "limit decision", method: "post", path: `/v1/admin/limits/changes/${ids.u}/decision`, permission: "limits.approve", body: { decision: "APPROVED" } },
  { name: "adjustment request", method: "post", path: "/v1/admin/adjustments", permission: "adjustments.request", body: { customerAccountId: ids.a, counterAccountId: ids.u, currency: "HKD", amountMinor: "1000", direction: "CREDIT", reason: "goodwill credit for delay" } },
  { name: "adjustment approve", method: "post", path: `/v1/admin/adjustments/${ids.u}/approve`, permission: "adjustments.approve" },
  { name: "provider request", method: "post", path: "/v1/admin/provider-approvals", permission: "provider.config.request", body: { providerId: "stripe", environment: "sandbox", contractRef: "CT-2026-0001" } },
  { name: "provider decision", method: "post", path: `/v1/admin/provider-approvals/${ids.u}/decision`, permission: "provider.config.approve", body: { decision: "APPROVED" } },
  { name: "pending approvals", method: "get", path: "/v1/admin/approvals", permission: "approvals.read" },
  { name: "pii reveal", method: "post", path: `/v1/admin/customers/${ids.u}/reveal`, permission: "customers.pii.reveal", body: { field: "PAN", reason: "CUSTOMER_REQUEST" } },
  { name: "audit log", method: "get", path: "/v1/admin/audit", permission: "audit.read" },
  { name: "staff role", method: "post", path: "/v1/admin/staff", permission: "staff.manage", body: { userId: ids.u, role: "SUPPORT_ADMIN" } },
];

const ROLES: StaffRole[] = ["SUPER_ADMIN", "FINANCE_ADMIN", "COMPLIANCE_ADMIN", "SUPPORT_ADMIN"];

describe("admin access", () => {
  it("a customer with no staff record is refused everywhere", async () => {
    const c = await registerCustomer(t, "plain-customer");
    const res = await http().get("/v1/admin/me").set(authed(c));
    expect(res.status).toBe(403);
    const denied = await t.container.db.auditLog.count({ where: { action: "admin_access_denied", actorUserId: c.userId } });
    expect(denied).toBe(1);
  });

  it("a staff member without confirmed two-factor is refused", async () => {
    const c = await registerCustomer(t, "no-mfa-staff");
    await t.container.db.staffMember.create({ data: { userId: c.userId, role: "SUPER_ADMIN", status: "ACTIVE", createdBy: "test-seed" } });
    const res = await http().get("/v1/admin/me").set(authed(c));
    expect(res.status).toBe(403);
  });

  it("an unauthenticated request is refused", async () => {
    await http().get("/v1/admin/me").expect(401);
  });

  it("a disabled staff member is refused", async () => {
    const c = await staff("SUPER_ADMIN");
    await t.container.db.staffMember.update({ where: { userId: c.userId }, data: { status: "DISABLED" } });
    await http().get("/v1/admin/me").set(authed(c)).expect(403);
  });

  it("is refused from a network that is not on the allow-list", async () => {
    const c = await staff("SUPER_ADMIN");
    const original = [...t.container.config.adminAllowedIps];
    t.container.config.adminAllowedIps.splice(0, t.container.config.adminAllowedIps.length, "203.0.113.5");
    try {
      const res = await http().get("/v1/admin/me").set(authed(c));
      expect(res.status).toBe(403);
      expect(res.body.error.message).toContain("network");
    } finally {
      t.container.config.adminAllowedIps.splice(0, t.container.config.adminAllowedIps.length, ...original);
    }
  });

  it("returns the caller's own role and permissions", async () => {
    const c = await staff("COMPLIANCE_ADMIN");
    const res = await http().get("/v1/admin/me").set(authed(c)).expect(200);
    expect(res.body.role).toBe("COMPLIANCE_ADMIN");
    expect(res.body.permissions).toEqual([...ROLE_PERMISSIONS.COMPLIANCE_ADMIN]);
  });
});

describe("permission matrix: every endpoint, every role", () => {
  it("allows exactly the permitted roles, and refuses the rest with 403", async () => {
    const sessions = new Map<StaffRole, Customer>();
    for (const r of ROLES) sessions.set(r, await staff(r));
    const failures: string[] = [];
    for (const ep of ENDPOINTS) {
      for (const role of ROLES) {
        const c = sessions.get(role)!;
        const allowed = ROLE_PERMISSIONS[role].includes(ep.permission);
        const req = ep.method === "get" ? http().get(ep.path) : http().post(ep.path);
        const res = await (ep.body !== undefined ? req.send(ep.body as object) : req.send({})).set(authed(c));
        const refused = res.status === 403;
        if (refused === allowed) failures.push(`${ep.name} as ${role}: expected ${allowed ? "allowed" : "refused"}, got ${res.status}`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("maker-checker and reveals", () => {
  it("refuses a provider approval approved by the person who requested it", async () => {
    const a = await staff("SUPER_ADMIN");
    const b = await staff("SUPER_ADMIN", "second-super-admin");
    const created = await http().post("/v1/admin/provider-approvals").set(authed(a)).send({ providerId: "stripe", environment: "sandbox", contractRef: "CT-2026-0002" }).expect(201);
    const approvalId = created.body.approvalId as string;
    const self = await http().post(`/v1/admin/provider-approvals/${approvalId}/decision`).set(authed(a)).send({ decision: "APPROVED" });
    expect(self.status).toBe(403);
    expect(self.body.error.code).toBe("SELF_APPROVAL");
    await http().post(`/v1/admin/provider-approvals/${approvalId}/decision`).set(authed(b)).send({ decision: "APPROVED" }).expect(200);
    const row = await t.container.db.providerApproval.findUnique({ where: { providerId_environment: { providerId: "stripe", environment: "sandbox" } } });
    expect(row?.approvedBy).toBe(b.userId);
  });

  it("reveals a PAN only with a reason code, and records the reveal", async () => {
    const customer = await registerCustomer(t, "pan-holder");
    await http().put("/v1/kyc/identity").set(authed(customer)).send({ pan: "ABCDE1234F", dateOfBirth: "1990-05-01", nationality: "HK" }).expect(200);
    const officer = await staff("COMPLIANCE_ADMIN");
    const bad = await http().post(`/v1/admin/customers/${customer.userId}/reveal`).set(authed(officer)).send({ field: "PAN", reason: "because" });
    expect(bad.status).toBe(400);
    const ok = await http().post(`/v1/admin/customers/${customer.userId}/reveal`).set(authed(officer)).send({ field: "PAN", reason: "FRAUD_INVESTIGATION" }).expect(200);
    expect(ok.body.value).toBe("ABCDE1234F");
    const audit = await t.container.db.auditLog.findFirst({ where: { action: "pii_revealed", subjectId: customer.userId } });
    expect(audit?.metadata).toMatchObject({ field: "PAN", reason: "FRAUD_INVESTIGATION" });
  });

  it("refuses a PII reveal to support staff and audits the refusal", async () => {
    const customer = await registerCustomer(t, "pan-holder-2");
    const support = await staff("SUPPORT_ADMIN");
    await http().post(`/v1/admin/customers/${customer.userId}/reveal`).set(authed(support)).send({ field: "PAN", reason: "CUSTOMER_REQUEST" }).expect(403);
    const denied = await t.container.db.auditLog.findFirst({ where: { action: "admin_permission_denied", actorUserId: support.userId } });
    expect(denied?.metadata).toMatchObject({ permission: "customers.pii.reveal" });
  });

  it("reads an identity document only with a reason, and audits the read", async () => {
    const customer = await registerCustomer(t, "doc-owner");
    await http().put("/v1/kyc/identity").set(authed(customer)).send({ pan: "ABCDE1234F", dateOfBirth: "1990-05-01", nationality: "HK" }).expect(200);
    await http().post("/v1/kyc/documents?kind=PASSPORT").set(authed(customer)).set("Content-Type", "image/png").send(PNG).expect(201);
    const file = await t.container.db.kycFile.findFirstOrThrow({ where: { kycRecord: { userId: customer.userId } } });
    const officer = await staff("COMPLIANCE_ADMIN");
    const noReason = await http().get(`/v1/admin/kyc/documents/${file.id}?reason=x`).set(authed(officer));
    expect(noReason.status).toBe(403);
    const ok = await http().get(`/v1/admin/kyc/documents/${file.id}?reason=identity%20check%20for%20the%20case`).set(authed(officer)).expect(200);
    expect(Buffer.from(ok.body).equals(PNG)).toBe(true);
    const reads = await t.container.db.auditLog.count({ where: { action: "kyc_document_read", subjectId: file.id } });
    expect(reads).toBe(1);
  });

  it("assigns a staff role only as super admin, and only to a user with two-factor", async () => {
    const compliance = await staff("COMPLIANCE_ADMIN");
    const target = await registerCustomer(t, "future-staff");
    await http().post("/v1/admin/staff").set(authed(compliance)).send({ userId: target.userId, role: "SUPPORT_ADMIN" }).expect(403);
    const superAdmin = await staff("SUPER_ADMIN");
    const noMfa = await http().post("/v1/admin/staff").set(authed(superAdmin)).send({ userId: target.userId, role: "SUPPORT_ADMIN" });
    expect(noMfa.status).toBe(422);
    await t.container.db.totpFactor.create({ data: { userId: target.userId, secretEnc: "x", confirmedAt: new Date() } });
    await http().post("/v1/admin/staff").set(authed(superAdmin)).send({ userId: target.userId, role: "SUPPORT_ADMIN" }).expect(201);
    const row = await t.container.db.staffMember.findUnique({ where: { userId: target.userId } });
    expect(row?.role).toBe("SUPPORT_ADMIN");
  });
});

describe("the public customer host does not serve admin routes", () => {
  it("every admin route is behind the staff guard (none answers without auth)", async () => {
    for (const ep of ENDPOINTS) {
      const res = await (ep.method === "get" ? http().get(ep.path) : http().post(ep.path).send({}));
      expect([401, 403], `${ep.name}`).toContain(res.status);
    }
  });
});
