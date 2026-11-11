import request from "supertest";
import { SignJWT } from "jose";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestApp, resetState, type TestApp } from "./helpers";
import { createFakeProviders } from "./provider-fake";
import { authed, registerCustomer, verifiedCustomer, type Customer } from "./support";

/** Automated attacks against the running API. These complement, and do not replace, a penetration test. */
let t: TestApp;
const http = () => request(t.app.getHttpServer());

beforeAll(async () => {
  t = await startTestApp({ transport: createFakeProviders().transport });
});
afterAll(async () => { await t.close(); });
beforeEach(async () => { await resetState(t); });

function forgeFrom(secret: Uint8Array, claims: Record<string, unknown>, alg = "HS256") {
  return new SignJWT(claims).setProtectedHeader({ alg }).setIssuedAt().setExpirationTime("15m").sign(secret);
}

describe("token forgery", () => {
  it("rejects a token signed with a different secret", async () => {
    const c = await registerCustomer(t, "probe-a");
    const forged = await forgeFrom(randomBytes(64), { sub: c.userId, sid: "x", did: "y" });
    await http().get("/v1/accounts").set("Authorization", `Bearer ${forged}`).expect(401);
  });

  it("rejects an unsigned token (alg none)", async () => {
    const c = await registerCustomer(t, "probe-b");
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ sub: c.userId, sid: "x", did: "y", exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
    await http().get("/v1/accounts").set("Authorization", `Bearer ${header}.${body}.`).expect(401);
  });

  it("rejects a valid token whose payload was edited to another user", async () => {
    const victim = await registerCustomer(t, "probe-victim");
    const attacker = await registerCustomer(t, "probe-attacker");
    const [h, , s] = victim.access.split(".");
    const edited = Buffer.from(JSON.stringify({ sub: attacker.userId, sid: "x", did: "y", exp: Math.floor(Date.now() / 1000) + 600, iat: Math.floor(Date.now() / 1000) })).toString("base64url");
    await http().get("/v1/accounts").set("Authorization", `Bearer ${h}.${edited}.${s}`).expect(401);
  });

  it("rejects an expired token", async () => {
    const c = await registerCustomer(t, "probe-expired");
    const { createHash } = await import("node:crypto");
    void createHash;
    const secret = t.container.config.accessTokenSecret;
    const expired = await new SignJWT({ sub: c.userId, sid: "x", did: "y" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt(Math.floor(Date.now() / 1000) - 7200).setExpirationTime(Math.floor(Date.now() / 1000) - 3600).sign(secret);
    await http().get("/v1/accounts").set("Authorization", `Bearer ${expired}`).expect(401);
  });

  it("does not accept a token for a session that has been ended", async () => {
    const c = await registerCustomer(t, "probe-ended");
    await http().post("/v1/auth/logout").set(authed(c)).expect(200);
    await http().get("/v1/accounts").set(authed(c)).expect(401);
  });
});

describe("mass assignment and unexpected fields", () => {
  it("refuses extra fields that try to set server-owned state on a transfer", async () => {
    const c = await verifiedCustomer(t, "probe-mass");
    const res = await http().post("/v1/transfers/internal").set(authed(c)).send({
      toAccountRef: "HKA00000000", currency: "HKD", amountMinor: "100", idempotencyKey: "probe-mass-1", status: "POSTED", ledgerTransactionId: "x",
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.body.error?.code).toBe("VALIDATION_FAILED");
  });

  it("refuses an injected account id on a beneficiary", async () => {
    const c = await verifiedCustomer(t, "probe-bene");
    const res = await http().post("/v1/beneficiaries").set(authed(c)).send({ name: "A", country: "IN", method: "upi", destination: "a@upi", currency: "INR", accountId: "someone-else" });
    expect(res.status).toBe(400);
  });

  it("refuses an injected role on KYC identity", async () => {
    const c = await registerCustomer(t, "probe-role");
    const res = await http().put("/v1/kyc/identity").set(authed(c)).send({ pan: "ABCDE1234F", dateOfBirth: "1990-05-01", nationality: "HK", tier: "ENHANCED", status: "VERIFIED" });
    expect(res.status).toBe(400);
    expect((await http().get("/v1/kyc").set(authed(c))).body.status).toBe("NOT_STARTED");
  });
});

describe("hostile input", () => {
  it("stores a SQL-looking beneficiary name as plain text and leaves the database intact", async () => {
    const c = await verifiedCustomer(t, "probe-sql");
    const name = "Robert'); DROP TABLE \"Transfer\"; --";
    const created = await http().post("/v1/beneficiaries").set(authed(c)).send({ name, country: "IN", method: "upi", destination: "rob@upi", currency: "INR" });
    expect(created.status).toBe(201);
    const list = await http().get("/v1/beneficiaries").set(authed(c)).expect(200);
    expect(list.body.items.find((b: { id: string }) => b.id === created.body.id)?.name).toBe(name);
    const tables = await t.container.db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*)::bigint AS n FROM information_schema.tables WHERE table_name = 'Transfer'`);
    expect(Number(tables[0]?.n)).toBe(1);
  });

  it("rejects a webhook body over the raw limit before parsing it", async () => {
    const big = "x".repeat(300 * 1024);
    const res = await http().post("/v1/webhooks/stripe").set("Content-Type", "application/json").send(big);
    expect(res.status).toBe(413);
  });

  it("returns a generic answer for an unknown method on a real route, with no stack trace", async () => {
    const res = await http().patch("/v1/accounts");
    expect([404, 405]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toMatch(/at \w+|\.ts:|node_modules/);
  });

  it("does not expose internal identifiers or ciphertext in customer responses", async () => {
    const c = await verifiedCustomer(t, "probe-leak");
    await http().put("/v1/kyc/identity").set(authed(c)).send({ pan: "ABCDE1234F", dateOfBirth: "1990-05-01", nationality: "HK" }).expect(200);
    const kyc = await http().get("/v1/kyc").set(authed(c)).expect(200);
    const text = JSON.stringify(kyc.body);
    for (const forbidden of ["panEnc", "dateOfBirthEnc", "wrappedKey", "storageKey", "ABCDE1234F"]) {
      expect(text).not.toContain(forbidden);
    }
    const dash = await http().get("/v1/dashboard").set(authed(c)).expect(200);
    expect(JSON.stringify(dash.body)).not.toMatch(/ledgerAccountId|LedgerAccount|hashRequest/);
  });
});

describe("staff data is masked by default", () => {
  it("shows customer emails in masked form on the admin user list", async () => {
    const customer: Customer = await registerCustomer(t, "probe-mask-target");
    const { createHash } = await import("node:crypto");
    void createHash;
    const officer = await registerCustomer(t, "probe-officer");
    await t.container.db.totpFactor.create({ data: { userId: officer.userId, secretEnc: "x", confirmedAt: new Date() } });
    await t.container.db.staffMember.create({ data: { userId: officer.userId, role: "COMPLIANCE_ADMIN", status: "ACTIVE", createdBy: "probe" } });
    const res = await http().get("/v1/admin/users?limit=50").set(authed(officer)).expect(200);
    const row = res.body.items.find((u: { userId: string }) => u.userId === customer.userId);
    expect(row).toBeDefined();
    expect(row.emailMasked).toMatch(/^.\*\*\*@/);
    expect(JSON.stringify(res.body)).not.toContain(customer.name);
  });
});
