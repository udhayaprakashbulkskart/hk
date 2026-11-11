import request from "supertest";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestApp, resetState, type TestApp } from "./helpers";
import { createFakeProviders } from "./provider-fake";
import { verifiedCustomer, authed, balanceOf, fundHkd, fundInr, lastKey, razorpayXWebhook, registerCustomer, type Ctx, type Customer } from "./support";

let t: TestApp;
let ctx: Ctx;
const http = () => request(t.app.getHttpServer());

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

async function indianRecipient(c: Customer, name = "Priya Raman"): Promise<string> {
  const res = await http().post("/v1/beneficiaries").set(authed(c)).send({ name, country: "IN", method: "upi", destination: "priya.raman@upi", currency: "INR" }).expect(201);
  return res.body.id as string;
}

async function quote(c: Customer, amountMinor: string, to = "INR") {
  const res = await http().post("/v1/fx/quotes").set(authed(c)).send({ from: "HKD", to, amountMinor }).expect(201);
  return res.body as { id: string; recipientMinor: string; feeMinor: string };
}

function payout(c: Customer, beneficiaryId: string, amountMinor: string, fxQuoteId: string | null, key = `t-${randomUUID()}`) {
  return http().post("/v1/transfers").set(authed(c)).send({ beneficiaryId, sourceCurrency: "HKD", amountMinor, fxQuoteId, idempotencyKey: key });
}

describe("outbound transfers", () => {
  it("leaves balances unchanged while a transfer is pending, and reserves the amount against further spending", async () => {
    const c = await verifiedCustomer(t, "pending-xfer");
    await fundHkd(ctx, c, "200000");
    const bene = await indianRecipient(c);
    const q = await quote(c, "100000");
    const res = await payout(c, bene, "100000", q.id).expect(201);
    expect(res.body.status).toBe("SUBMITTED");
    expect(res.body.debit.amountMinor).toBe("100000");

    // Pending: the ledger has not moved.
    expect(await balanceOf(t, c.accountId, "HKD", "AVAILABLE")).toBe(200000n);
    expect(await balanceOf(t, c.accountId, "HKD", "HOLD")).toBe(0n);
    expect(await t.container.transfers.reservedFor(c.accountId, "HKD")).toBe(100000n);

    // A second payout that the reservation makes unaffordable is refused.
    const q2 = await quote(c, "150000");
    const refused = await payout(c, bene, "150000", q2.id);
    expect(refused.status).toBe(422);
    expect(refused.body.error.code).toBe("INSUFFICIENT_FUNDS");
  });

  it("posts the settlement only when the provider confirms, and then debits the customer", async () => {
    const c = await verifiedCustomer(t, "confirm-xfer");
    await fundHkd(ctx, c, "200000");
    const bene = await indianRecipient(c);
    const q = await quote(c, "100000");
    const sent = await payout(c, bene, "100000", q.id).expect(201);
    const payoutId = lastKey(ctx.fake.state.payouts);

    // The provider says queued, and the webhook says processed: confirmation requires the provider's status.
    ctx.fake.state.payouts.set(payoutId, "queued");
    await razorpayXWebhook(ctx, "payout.processed", payoutId).expect(200);
    expect((await http().get(`/v1/transfers/${sent.body.id}`).set(authed(c))).body.status).toBe("SUBMITTED");
    expect(await balanceOf(t, c.accountId, "HKD", "AVAILABLE")).toBe(200000n);

    ctx.fake.state.payouts.set(payoutId, "processed");
    const confirmed = await razorpayXWebhook(ctx, "payout.processed", payoutId).expect(200);
    expect(confirmed.body.outcomes).toEqual(["processed"]);
    const done = await http().get(`/v1/transfers/${sent.body.id}`).set(authed(c)).expect(200);
    expect(done.body.status).toBe("POSTED");
    expect(await balanceOf(t, c.accountId, "HKD", "AVAILABLE")).toBe(100000n);
    expect(await t.container.transfers.reservedFor(c.accountId, "HKD")).toBe(0n);
    expect((await t.container.ledger.reconcile()).mismatches).toHaveLength(0);
  });

  it("releases the reservation when the provider rejects the payout, and nothing was ever debited", async () => {
    const c = await verifiedCustomer(t, "rejected-xfer");
    await fundHkd(ctx, c, "200000");
    const bene = await indianRecipient(c);
    const q = await quote(c, "50000");
    const sent = await payout(c, bene, "50000", q.id).expect(201);
    const payoutId = lastKey(ctx.fake.state.payouts);
    ctx.fake.state.payouts.set(payoutId, "rejected");
    await razorpayXWebhook(ctx, "payout.rejected", payoutId).expect(200);

    const failed = await http().get(`/v1/transfers/${sent.body.id}`).set(authed(c)).expect(200);
    expect(failed.body.status).toBe("FAILED");
    expect(await balanceOf(t, c.accountId, "HKD", "AVAILABLE")).toBe(200000n);
    expect(await t.container.transfers.reservedFor(c.accountId, "HKD")).toBe(0n);
    // The money is spendable again.
    const q2 = await quote(c, "200000");
    await payout(c, bene, "200000", q2.id).expect(201);
  });

  it("refuses an idempotent replay with the same key without sending a second payout", async () => {
    const c = await verifiedCustomer(t, "replay-xfer");
    await fundInr(ctx, c, "300000");
    const bene = await indianRecipient(c);
    const key = `same-${randomUUID()}`;
    const a = await http().post("/v1/transfers").set(authed(c)).send({ beneficiaryId: bene, sourceCurrency: "INR", amountMinor: "100000", idempotencyKey: key }).expect(201);
    const b = await http().post("/v1/transfers").set(authed(c)).send({ beneficiaryId: bene, sourceCurrency: "INR", amountMinor: "100000", idempotencyKey: key }).expect(201);
    expect(b.body.id).toBe(a.body.id);
    expect(ctx.fake.state.sent.filter((s) => s.url.endsWith("/v1/payouts"))).toHaveLength(1);
  });

  it("does not let two simultaneous payouts both spend the same money", async () => {
    const c = await verifiedCustomer(t, "race-xfer");
    await fundInr(ctx, c, "100000");
    const bene = await indianRecipient(c);
    const results = await Promise.allSettled([
      http().post("/v1/transfers").set(authed(c)).send({ beneficiaryId: bene, sourceCurrency: "INR", amountMinor: "60000", idempotencyKey: `race-a-${randomUUID()}` }),
      http().post("/v1/transfers").set(authed(c)).send({ beneficiaryId: bene, sourceCurrency: "INR", amountMinor: "60000", idempotencyKey: `race-b-${randomUUID()}` }),
    ]);
    const statuses = results.map((r) => (r.status === "fulfilled" ? r.value.status : 0)).sort();
    expect(statuses).toEqual([201, 422]);
    expect(ctx.fake.state.sent.filter((s) => s.url.endsWith("/v1/payouts"))).toHaveLength(1);
  });

  it("refuses a route that is not enabled, reports it as not yet available, and sends nothing to a provider", async () => {
    const c = await verifiedCustomer(t, "swift-xfer");
    await fundHkd(ctx, c, "200000");
    const res = await http().post("/v1/beneficiaries").set(authed(c)).send({ name: "David Wong", country: "SG", method: "swift", destination: "DBSSSGSG0000005521", currency: "SGD" }).expect(201);
    const q = await quote(c, "100000", "SGD");
    const out = await payout(c, res.body.id, "100000", q.id);
    expect(out.status).toBe(503);
    expect(out.body.error.code).toBe("NOT_AVAILABLE");
    expect(ctx.fake.state.sent.some((s) => s.url.includes("payouts"))).toBe(false);
    expect(await t.container.transfers.reservedFor(c.accountId, "HKD")).toBe(0n);
  });

  it("requires a quote for a cross-currency payout and refuses a quote for a different amount", async () => {
    const c = await verifiedCustomer(t, "quote-mismatch");
    await fundHkd(ctx, c, "200000");
    const bene = await indianRecipient(c);
    const none = await payout(c, bene, "100000", null);
    expect(none.status).toBe(422);
    const q = await quote(c, "90000");
    const mismatch = await payout(c, bene, "100000", q.id);
    expect(mismatch.status).toBe(422);
  });

  it("a customer cannot see another customer's transfer", async () => {
    const a = await verifiedCustomer(t, "owner-xfer");
    const b = await verifiedCustomer(t, "other-xfer");
    await fundInr(ctx, a, "100000");
    const bene = await indianRecipient(a);
    const sent = await http().post("/v1/transfers").set(authed(a)).send({ beneficiaryId: bene, sourceCurrency: "INR", amountMinor: "10000", idempotencyKey: `own-${randomUUID()}` }).expect(201);
    expect((await http().get(`/v1/transfers/${sent.body.id}`).set(authed(b))).status).toBe(404);
  });
});

describe("internal transfers", () => {
  it("moves money between HK FinHub accounts instantly, and refuses self-transfers and overdrafts", async () => {
    const alice = await verifiedCustomer(t, "alice-int");
    const bob = await verifiedCustomer(t, "bob-int");
    await fundHkd(ctx, alice, "100000");
    const bobRef = (await http().get("/v1/accounts").set(authed(bob)).expect(200)).body.accountRef as string;
    const aliceRef = (await http().get("/v1/accounts").set(authed(alice)).expect(200)).body.accountRef as string;

    const sent = await http().post("/v1/transfers/internal").set(authed(alice)).send({ toAccountRef: bobRef, currency: "HKD", amountMinor: "30000", idempotencyKey: `int-${randomUUID()}` }).expect(201);
    expect(sent.body.status).toBe("POSTED");
    expect(await balanceOf(t, alice.accountId, "HKD", "AVAILABLE")).toBe(70000n);
    expect(await balanceOf(t, bob.accountId, "HKD", "AVAILABLE")).toBe(30000n);

    const self = await http().post("/v1/transfers/internal").set(authed(alice)).send({ toAccountRef: aliceRef, currency: "HKD", amountMinor: "1000", idempotencyKey: `self-${randomUUID()}` });
    expect(self.status).toBe(422);
    const over = await http().post("/v1/transfers/internal").set(authed(alice)).send({ toAccountRef: bobRef, currency: "HKD", amountMinor: "80000", idempotencyKey: `over-${randomUUID()}` });
    expect(over.body.error.code).toBe("INSUFFICIENT_FUNDS");
    const unknown = await http().post("/v1/transfers/internal").set(authed(alice)).send({ toAccountRef: "HKA00000000", currency: "HKD", amountMinor: "100", idempotencyKey: `nope-${randomUUID()}` });
    expect(unknown.status).toBe(404);
    expect((await t.container.ledger.reconcile()).mismatches).toHaveLength(0);
  });
});
