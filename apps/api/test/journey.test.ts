import request from "supertest";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { startTestApp, resetState, testEnv, type TestApp } from "./helpers";
import { createFakeProviders } from "./provider-fake";
import { authed, balanceOf, fundHkd, registerCustomer, type Ctx, type Customer } from "./support";

let t: TestApp;
let ctx: Ctx;
const http = () => request(t.app.getHttpServer());
const SECRET = testEnv()["KYC_WEBHOOK_SECRET"] as string;
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("passport")]);
const PDF = Buffer.from("%PDF-1.7 proof of address");

beforeAll(async () => {
  const fake = createFakeProviders();
  t = await startTestApp({ transport: fake.transport });
  ctx = { t, fake };
});
afterAll(async () => { await t.close(); });
beforeEach(async () => { await resetState(t); });

/** The real KYC path, end to end: details, documents, submission, and a signed provider PASS. */
async function completeKyc(c: Customer, name: string) {
  await http().put("/v1/kyc/identity").set(authed(c)).send({ pan: "ABCDE1234F", dateOfBirth: "1990-05-01", nationality: "HK" }).expect(200);
  await http().post("/v1/kyc/documents?kind=PASSPORT").set(authed(c)).set("Content-Type", "image/png").send(PNG).expect(201);
  await http().post("/v1/kyc/documents?kind=ADDRESS_PROOF").set(authed(c)).set("Content-Type", "application/pdf").send(PDF).expect(201);
  await http().post("/v1/kyc/submit").set(authed(c)).send({ fullName: name }).expect(200);
  const rec = await t.container.db.kycRecord.findUniqueOrThrow({ where: { userId: c.userId } });
  const raw = JSON.stringify({ providerRef: rec.providerRef, outcome: "PASS" });
  const sig = createHmac("sha256", SECRET).update(raw).digest("hex");
  await http().post("/v1/kyc/webhook").set("Content-Type", "application/json").set("x-kyc-signature", sig).send(raw).expect(200);
}

async function accountRef(c: Customer): Promise<string> {
  return (await http().get("/v1/accounts").set(authed(c)).expect(200)).body.accountRef as string;
}

describe("one customer journey across the platform", () => {
  it("register, verify, fund, receive, invest, and send, with the dashboard agreeing with the ledger", async () => {
    // 1. Register and verify identity through the real KYC path.
    const alice = await registerCustomer(t, "alice-journey");
    const bob = await registerCustomer(t, "bob-journey");
    await completeKyc(alice, "Alice Journey");
    await completeKyc(bob, "Bob Journey");
    const kycStatus = await http().get("/v1/kyc").set(authed(alice)).expect(200);
    expect(kycStatus.body.status).toBe("VERIFIED");

    // 2. Fund. The deposit is confirmed by the provider path, not typed in.
    await fundHkd(ctx, alice, "2000000");
    expect(await balanceOf(t, alice.accountId, "HKD", "AVAILABLE")).toBe(2000000n);

    // 3. Receive: Bob is paid instantly by Alice, a same-currency internal transfer.
    await http().post("/v1/transfers/internal").set(authed(alice)).send({ toAccountRef: await accountRef(bob), currency: "HKD", amountMinor: "300000", idempotencyKey: `j-${randomUUID()}` }).expect(201);
    expect(await balanceOf(t, bob.accountId, "HKD", "AVAILABLE")).toBe(300000n);

    // 4. Invest: place a buy, the broker fills it, and cash settles once.
    const buy = await http().post("/v1/investments/orders").set(authed(alice)).send({ symbol: "ACME", side: "BUY", quantity: "2", limitPriceMinor: "100000", currency: "HKD", idempotencyKey: `j-${randomUUID()}` }).expect(201);
    const row = await t.container.db.investmentOrder.findUniqueOrThrow({ where: { id: buy.body.id } });
    t.container.sandboxBroker!.executeFills(row.brokerOrderId, [{ quantity: 2n, priceMinor: 100000n }]);
    const settled = await http().post(`/v1/investments/orders/${buy.body.id}/sync`).set(authed(alice)).expect(200);
    expect(settled.body.status).toBe("SETTLED");
    const holdings = await http().get("/v1/investments/holdings").set(authed(alice)).expect(200);
    expect(holdings.body.items[0]).toMatchObject({ symbol: "ACME", quantity: "2" });

    // 5. Send abroad: a payout is reserved while the provider works on it. Balances do not move yet.
    const bene = await http().post("/v1/beneficiaries").set(authed(alice)).send({ name: "Priya Raman", country: "IN", method: "upi", destination: "priya.raman@upi", currency: "INR" }).expect(201);
    const q = await http().post("/v1/fx/quotes").set(authed(alice)).send({ from: "HKD", to: "INR", amountMinor: "100000" }).expect(201);
    const pay = await http().post("/v1/transfers").set(authed(alice)).send({ beneficiaryId: bene.body.id, sourceCurrency: "HKD", amountMinor: "100000", fxQuoteId: q.body.id, idempotencyKey: `j-${randomUUID()}` }).expect(201);
    expect(pay.body.status).toBe("SUBMITTED");

    // 6. The dashboard agrees with the ledger: cash, the pending send, KYC, and the investment's cost basis.
    const dash = await http().get("/v1/dashboard").set(authed(alice)).expect(200);
    expect(dash.body.kyc.status).toBe("VERIFIED");
    expect(dash.body.pendingOutgoing.amountMinor).toBe("100000");
    const expectedAvailable = 2000000n - 300000n - 2n * 100000n;
    expect(await balanceOf(t, alice.accountId, "HKD", "AVAILABLE")).toBe(expectedAvailable);
    expect(dash.body.investmentValue.source).toContain("Investments");
    const bobDash = await http().get("/v1/dashboard").set(authed(bob)).expect(200);
    expect(bobDash.body.cashTotal.amountMinor).toBe("300000");
  });

  it("an unverified customer can receive money but cannot invest or send", async () => {
    const alice = await verifiedFunded("Journey Payer");
    const newcomer = await registerCustomer(t, "journey-newcomer");
    await http().post("/v1/transfers/internal").set(authed(alice)).send({ toAccountRef: await accountRef(newcomer), currency: "HKD", amountMinor: "10000", idempotencyKey: `j-${randomUUID()}` }).expect(201);
    expect(await balanceOf(t, newcomer.accountId, "HKD", "AVAILABLE")).toBe(10000n);
    await http().post("/v1/investments/orders").set(authed(newcomer)).send({ symbol: "ACME", side: "BUY", quantity: "1", limitPriceMinor: "1000", currency: "HKD", idempotencyKey: `j-${randomUUID()}` }).expect(403);
    await http().post("/v1/transfers/internal").set(authed(newcomer)).send({ toAccountRef: await accountRef(alice), currency: "HKD", amountMinor: "100", idempotencyKey: `j-${randomUUID()}` }).expect(403);
  });
});

async function verifiedFunded(name: string): Promise<Customer> {
  const c = await registerCustomer(t, name.toLowerCase().replace(/ /g, "-"));
  await completeKyc(c, name);
  await fundHkd(ctx, c, "100000");
  return c;
}
