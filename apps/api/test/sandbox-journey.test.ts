import request from "supertest";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestApp, resetState, type TestApp } from "./helpers";
import { createFakeProviders } from "./provider-fake";
import { verifiedCustomer, authed, balanceOf, fundHkd, lastKey, razorpayXWebhook, registerCustomer, type Ctx } from "./support";

let t: TestApp;
let ctx: Ctx;
const http = () => request(t.app.getHttpServer());

beforeAll(async () => {
  const fake = createFakeProviders();
  t = await startTestApp({ transport: fake.transport });
  ctx = { t, fake };
});
afterAll(async () => { await t.close(); });
beforeEach(async () => { await resetState(t); ctx.fake.state.payouts.clear(); ctx.fake.state.intents.clear(); ctx.fake.state.sent.length = 0; });

/** The sandbox loop from the phase 6 exit criteria, end to end, against the HTTP surface. */
describe("sandbox journey", () => {
  it("collection posts, payout posts, and the books balance", async () => {
    const c = await verifiedCustomer(t, "journey-ok");
    await fundHkd(ctx, c, "250000"); // collection: Stripe, confirmed and posted
    expect(await balanceOf(t, c.accountId, "HKD", "AVAILABLE")).toBe(250000n);

    const bene = await http().post("/v1/beneficiaries").set(authed(c)).send({ name: "Priya Raman", country: "IN", method: "upi", destination: "priya.raman@upi", currency: "INR" }).expect(201);
    const quote = await http().post("/v1/fx/quotes").set(authed(c)).send({ from: "HKD", to: "INR", amountMinor: "100000" }).expect(201);
    const sent = await http().post("/v1/transfers").set(authed(c)).send({ beneficiaryId: bene.body.id, sourceCurrency: "HKD", amountMinor: "100000", fxQuoteId: quote.body.id, idempotencyKey: `j-${randomUUID()}` }).expect(201);
    expect(sent.body.status).toBe("SUBMITTED");
    expect(await balanceOf(t, c.accountId, "HKD", "AVAILABLE")).toBe(250000n); // pending: unchanged

    const payoutId = lastKey(ctx.fake.state.payouts);
    ctx.fake.state.payouts.set(payoutId, "processed");
    await razorpayXWebhook(ctx, "payout.processed", payoutId).expect(200);
    const done = await http().get(`/v1/transfers/${sent.body.id}`).set(authed(c)).expect(200);
    expect(done.body.status).toBe("POSTED");
    expect(await balanceOf(t, c.accountId, "HKD", "AVAILABLE")).toBe(150000n);

    const rec = await t.container.ledger.reconcile();
    expect(rec.mismatches).toHaveLength(0);
    expect(rec.checked).toBeGreaterThan(0);
  });

  it("a failed payout releases the funds and leaves the customer exactly where they were", async () => {
    const c = await verifiedCustomer(t, "journey-fail");
    await fundHkd(ctx, c, "250000");
    const bene = await http().post("/v1/beneficiaries").set(authed(c)).send({ name: "Priya Raman", country: "IN", method: "upi", destination: "priya.raman@upi", currency: "INR" }).expect(201);
    const quote = await http().post("/v1/fx/quotes").set(authed(c)).send({ from: "HKD", to: "INR", amountMinor: "100000" }).expect(201);
    await http().post("/v1/transfers").set(authed(c)).send({ beneficiaryId: bene.body.id, sourceCurrency: "HKD", amountMinor: "100000", fxQuoteId: quote.body.id, idempotencyKey: `jf-${randomUUID()}` }).expect(201);
    const payoutId = lastKey(ctx.fake.state.payouts);
    ctx.fake.state.payouts.set(payoutId, "rejected");
    await razorpayXWebhook(ctx, "payout.rejected", payoutId).expect(200);

    expect(await balanceOf(t, c.accountId, "HKD", "AVAILABLE")).toBe(250000n);
    expect(await t.container.transfers.reservedFor(c.accountId, "HKD")).toBe(0n);
    expect((await t.container.ledger.reconcile()).mismatches).toHaveLength(0);
  });
});
