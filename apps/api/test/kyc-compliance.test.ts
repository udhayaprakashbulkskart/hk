import request from "supertest";
import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestApp, resetState, testEnv, type TestApp } from "./helpers";
import { createFakeProviders } from "./provider-fake";
import { authed, balanceOf, fundHkd, registerCustomer, type Ctx, type Customer } from "./support";

let t: TestApp;
let ctx: Ctx;
const http = () => request(t.app.getHttpServer());
const WEBHOOK_SECRET = testEnv()["KYC_WEBHOOK_SECRET"] as string;

// Minimal valid files. The sniffed type must match the declared Content-Type.
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("passport scan body")]);
const PDF = Buffer.from("%PDF-1.7 address proof body");
const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

beforeAll(async () => {
  const fake = createFakeProviders();
  t = await startTestApp({ transport: fake.transport });
  ctx = { t, fake };
});
afterAll(async () => { await t.close(); });
beforeEach(async () => {
  await resetState(t);
  ctx.fake.state.intents.clear(); ctx.fake.state.orders.clear(); ctx.fake.state.payouts.clear(); ctx.fake.state.refunded.clear(); ctx.fake.state.reject.clear(); ctx.fake.state.sent.length = 0;
});

/** Marks a customer verified. Tests use this directly; the real path is the KYC submission and provider verdict. */
async function verify(c: Customer): Promise<void> {
  const now = new Date();
  await t.container.db.kycRecord.upsert({
    where: { userId: c.userId },
    create: { userId: c.userId, status: "VERIFIED", tier: "STANDARD", verifiedAt: now },
    update: { status: "VERIFIED", tier: "STANDARD", verifiedAt: now },
  });
}

async function indianRecipient(c: Customer, name = "Priya Raman"): Promise<string> {
  const res = await http().post("/v1/beneficiaries").set(authed(c)).send({ name, country: "IN", method: "upi", destination: "priya.raman@upi", currency: "INR" }).expect(201);
  return res.body.id as string;
}

async function quote(c: Customer, amountMinor: string) {
  const res = await http().post("/v1/fx/quotes").set(authed(c)).send({ from: "HKD", to: "INR", amountMinor }).expect(201);
  return res.body as { id: string };
}

function payout(c: Customer, beneficiaryId: string, amountMinor: string, fxQuoteId: string) {
  return http().post("/v1/transfers").set(authed(c)).send({ beneficiaryId, sourceCurrency: "HKD", amountMinor, fxQuoteId, idempotencyKey: `k-${randomUUID()}` });
}

describe("KYC gate on outbound money", () => {
  it("refuses a payout from a customer who is not verified", async () => {
    const c = await registerCustomer(t, "not-verified");
    await fundHkd(ctx, c, "200000");
    const bene = await indianRecipient(c);
    const q = await quote(c, "100000");
    const res = await payout(c, bene, "100000", q.id);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("KYC_REQUIRED");
    expect(await balanceOf(t, c.accountId, "HKD", "AVAILABLE")).toBe(200000n);
  });
});

describe("sanctions screening holds money until cleared", () => {
  it("holds a payout to a sanctioned recipient, and releases it after a compliance admin clears the case", async () => {
    const c = await registerCustomer(t, "screen-hold");
    await verify(c);
    await fundHkd(ctx, c, "200000");
    const bene = await indianRecipient(c, "SANDBOX SANCTIONED Recipient");

    const held = await payout(c, bene, "100000", (await quote(c, "100000")).id);
    expect(held.status).toBe(403);
    expect(held.body.error.code).toBe("COMPLIANCE_HOLD");
    // The customer is not told why. The message does not mention screening.
    expect(JSON.stringify(held.body)).not.toMatch(/sanction|screen/i);

    const kase = await t.container.db.complianceCase.findFirst({ where: { subjectType: "BENEFICIARY", subjectId: bene, status: "OPEN" } });
    expect(kase?.blocking).toBe(true);
    await t.container.compliance.clearCase({ id: "staff-compliance-1", role: "COMPLIANCE_ADMIN" }, kase!.id, "reviewed: name match is a false positive");

    const released = await payout(c, bene, "100000", (await quote(c, "100000")).id);
    expect(released.status).toBe(201);
    expect(released.body.status).toBe("SUBMITTED");
  });

  it("does not let a non-compliance role clear a case", async () => {
    const c = await registerCustomer(t, "clear-denied");
    await verify(c);
    const bene = await indianRecipient(c, "SANDBOX SANCTIONED Recipient");
    const kase = await t.container.db.complianceCase.findFirst({ where: { subjectId: bene } });
    await expect(t.container.compliance.clearCase({ id: "support-1", role: "SUPPORT_ADMIN" }, kase!.id, "trying to clear this case")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("holds a customer's identity verdict for review when the customer is screened as a hit", async () => {
    const c = await registerCustomer(t, "kyc-hit");
    await putIdentity(c);
    await upload(c, "PASSPORT", "image/png", PNG);
    await upload(c, "ADDRESS_PROOF", "application/pdf", PDF);
    await http().post("/v1/kyc/submit").set(authed(c)).send({ fullName: "SANDBOX SANCTIONED Customer" }).expect(200);
    const rec = await t.container.db.kycRecord.findUniqueOrThrow({ where: { userId: c.userId } });
    await webhook({ providerRef: rec.providerRef, outcome: "PASS" }).expect(200);
    const after = await http().get("/v1/kyc").set(authed(c)).expect(200);
    expect(after.body.status).toBe("UNDER_REVIEW");
  });
});

describe("transaction limits", () => {
  it("rejects a transfer over the per-transaction limit with the limit and nothing moved", async () => {
    const c = await registerCustomer(t, "per-tx-limit");
    await verify(c);
    await fundHkd(ctx, c, "3000000");
    const bene = await indianRecipient(c);
    const res = await payout(c, bene, "1100000", (await quote(c, "1100000")).id);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("LIMIT_EXCEEDED");
    expect(res.body.error.details).toMatchObject({ scope: "PER_TX", limitMinor: "1000000", requestedMinor: "1100000" });
    expect(res.body.error.message).toContain("10,000.00 HKD");
    expect(await balanceOf(t, c.accountId, "HKD", "AVAILABLE")).toBe(3000000n);
  });

  it("counts earlier transfers in the day, and refuses the one that crosses the daily limit", async () => {
    const c = await registerCustomer(t, "daily-limit");
    await verify(c);
    await fundHkd(ctx, c, "3000000");
    const bene = await indianRecipient(c);
    expect((await payout(c, bene, "900000", (await quote(c, "900000")).id)).status).toBe(201);
    expect((await payout(c, bene, "900000", (await quote(c, "900000")).id)).status).toBe(201);
    const res = await payout(c, bene, "300000", (await quote(c, "300000")).id);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("LIMIT_EXCEEDED");
    expect(res.body.error.details).toMatchObject({ scope: "DAILY", corridor: "IN", usedMinor: "1800000", limitMinor: "2000000" });
  });
});

describe("identity documents and the provider webhook", () => {
  it("refuses a file with the malware test signature and does not store it", async () => {
    const c = await registerCustomer(t, "malware");
    const body = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(EICAR, "latin1")]);
    const res = await upload(c, "PASSPORT", "image/jpeg", body);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("MALWARE_DETECTED");
    expect(await t.container.db.kycFile.count()).toBe(0);
  });

  it("refuses a file whose bytes do not match the declared type", async () => {
    const c = await registerCustomer(t, "wrong-type");
    const res = await upload(c, "PASSPORT", "image/jpeg", PNG);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("FILE_REJECTED");
  });

  it("rejects an unsigned or wrongly signed provider webhook", async () => {
    const body = JSON.stringify({ providerRef: "nope", outcome: "PASS" });
    await http().post("/v1/kyc/webhook").set("Content-Type", "application/json").send(body).expect(401);
    await http().post("/v1/kyc/webhook").set("Content-Type", "application/json").set("x-kyc-signature", "00".repeat(32)).send(body).expect(401);
  });

  it("applies a correctly signed PASS and moves the customer to verified", async () => {
    const c = await registerCustomer(t, "kyc-pass");
    await putIdentity(c);
    await upload(c, "PASSPORT", "image/png", PNG);
    await upload(c, "ADDRESS_PROOF", "application/pdf", PDF);
    const sub = await http().post("/v1/kyc/submit").set(authed(c)).send({ fullName: "Test Customer" }).expect(200);
    expect(sub.body.status).toBe("UNDER_REVIEW");
    const rec = await t.container.db.kycRecord.findUniqueOrThrow({ where: { userId: c.userId } });
    await webhook({ providerRef: rec.providerRef, outcome: "PASS" }).expect(200);
    const status = await http().get("/v1/kyc").set(authed(c)).expect(200);
    expect(status.body.status).toBe("VERIFIED");
    expect(status.body.tier).toBe("STANDARD");
    expect(JSON.stringify(status.body)).not.toContain("ABCDE1234F");
  });

  it("reports the real KYC status on the dashboard", async () => {
    const c = await registerCustomer(t, "dash-kyc");
    const before = await http().get("/v1/dashboard").set(authed(c)).expect(200);
    expect(before.body.kyc.status).toBe("NOT_STARTED");
    await verify(c);
    const after = await http().get("/v1/dashboard").set(authed(c)).expect(200);
    expect(after.body.kyc.status).toBe("VERIFIED");
  });
});

// --------------------------------------------------------------------- helpers

async function putIdentity(c: Customer) {
  await http().put("/v1/kyc/identity").set(authed(c)).send({ pan: "ABCDE1234F", dateOfBirth: "1990-05-01", nationality: "HK" }).expect(200);
}

function upload(c: Customer, kind: string, mime: string, body: Buffer) {
  return http().post(`/v1/kyc/documents?kind=${kind}`).set(authed(c)).set("Content-Type", mime).send(body);
}

function webhook(payload: Record<string, unknown>) {
  const raw = JSON.stringify(payload);
  const sig = createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex");
  return http().post("/v1/kyc/webhook").set("Content-Type", "application/json").set("x-kyc-signature", sig).send(raw);
}
