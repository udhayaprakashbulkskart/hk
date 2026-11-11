import request from "supertest";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestApp, resetState, type TestApp } from "./helpers";
import { createFakeProviders } from "./provider-fake";
import { authed, balanceOf, fundHkd, lastKey, registerCustomer, stripeWebhook, type Ctx } from "./support";

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
  ctx.fake.state.intents.clear(); ctx.fake.state.sent.length = 0;
});

describe("currency conversion", () => {
  it("computes fee and recipient amount in whole minor units, rounding in the platform's favour", async () => {
    const c = await registerCustomer(t, "fx-math");
    const q = await http().post("/v1/fx/quotes").set(authed(c)).send({ from: "HKD", to: "USD", amountMinor: "10000" }).expect(201);
    // Fee: 0.20% of HK$100.00 = 20 cents. Net 9,980 cents at 0.1282 USD per HKD = 1,279.36, rounded down to 1,279.
    expect(q.body.feeMinor).toBe("20");
    expect(q.body.recipientMinor).toBe("1279");
    expect(q.body.rateScaled).toBe("12820000");
    expect(q.body.rateScale).toBe("100000000");
    expect(q.body.sample).toBe(true);
  });

  it("converts once: balances move in both currencies, and the same quote cannot be used twice", async () => {
    const c = await registerCustomer(t, "fx-once");
    await fundHkd(ctx, c, "50000");
    const q = await http().post("/v1/fx/quotes").set(authed(c)).send({ from: "HKD", to: "USD", amountMinor: "10000" }).expect(201);
    const done = await http().post("/v1/fx/conversions").set(authed(c)).send({ quoteId: q.body.id, idempotencyKey: `conv-${randomUUID()}` }).expect(201);
    expect(done.body.conversion.recipientMinor).toBe("1279");
    expect(await balanceOf(t, c.accountId, "HKD", "AVAILABLE")).toBe(40000n);
    expect(await balanceOf(t, c.accountId, "USD", "AVAILABLE")).toBe(1279n);
    const again = await http().post("/v1/fx/conversions").set(authed(c)).send({ quoteId: q.body.id, idempotencyKey: `conv2-${randomUUID()}` });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("QUOTE_ALREADY_USED");
    expect((await t.container.ledger.reconcile()).mismatches).toHaveLength(0);
  });

  it("refuses a quote that has expired", async () => {
    const c = await registerCustomer(t, "fx-expired");
    await fundHkd(ctx, c, "50000");
    const q = await http().post("/v1/fx/quotes").set(authed(c)).send({ from: "HKD", to: "USD", amountMinor: "10000" }).expect(201);
    await t.container.db.fxQuote.update({ where: { id: q.body.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await http().post("/v1/fx/conversions").set(authed(c)).send({ quoteId: q.body.id, idempotencyKey: `exp-${randomUUID()}` });
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe("QUOTE_EXPIRED");
  });

  it("refuses a conversion the customer cannot afford, and a quote for the same currency", async () => {
    const c = await registerCustomer(t, "fx-poor");
    await fundHkd(ctx, c, "1000");
    const big = await http().post("/v1/fx/quotes").set(authed(c)).send({ from: "HKD", to: "USD", amountMinor: "999999" }).expect(201);
    const res = await http().post("/v1/fx/conversions").set(authed(c)).send({ quoteId: big.body.id, idempotencyKey: `poor-${randomUUID()}` });
    expect(res.body.error.code).toBe("INSUFFICIENT_FUNDS");
    expect(await balanceOf(t, c.accountId, "HKD", "AVAILABLE")).toBe(1000n);
    const same = await http().post("/v1/fx/quotes").set(authed(c)).send({ from: "HKD", to: "HKD", amountMinor: "100" });
    expect(same.status).toBe(422);
  });

  it("does not let a conversion spend money that a pending transfer has reserved", async () => {
    const c = await registerCustomer(t, "fx-reserved");
    await fundHkd(ctx, c, "10000");
    const bene = await http().post("/v1/beneficiaries").set(authed(c)).send({ name: "Priya Raman", country: "IN", method: "upi", destination: "priya@upi", currency: "INR" }).expect(201);
    const tq = await http().post("/v1/fx/quotes").set(authed(c)).send({ from: "HKD", to: "INR", amountMinor: "8000" }).expect(201);
    await http().post("/v1/transfers").set(authed(c)).send({ beneficiaryId: bene.body.id, sourceCurrency: "HKD", amountMinor: "8000", fxQuoteId: tq.body.id, idempotencyKey: `res-${randomUUID()}` }).expect(201);
    const fq = await http().post("/v1/fx/quotes").set(authed(c)).send({ from: "HKD", to: "USD", amountMinor: "5000" }).expect(201);
    const res = await http().post("/v1/fx/conversions").set(authed(c)).send({ quoteId: fq.body.id, idempotencyKey: `res-conv-${randomUUID()}` });
    expect(res.body.error.code).toBe("INSUFFICIENT_FUNDS");
  });

  it("returns a labelled sample history for a pair", async () => {
    const c = await registerCustomer(t, "fx-hist");
    const res = await http().get("/v1/fx/history?from=HKD&to=USD&days=10").set(authed(c)).expect(200);
    expect(res.body.sample).toBe(true);
    expect(res.body.points).toHaveLength(10);
  });
});

describe("payment requests", () => {
  it("lets a payer see the request without any account details, pay it, and closes the request once confirmed", async () => {
    const alice = await registerCustomer(t, "req-alice");
    const bob = await registerCustomer(t, "req-bob");
    const created = await http().post("/v1/payment-requests").set(authed(alice)).send({ currency: "HKD", amountMinor: "5000", memo: "Dinner" }).expect(201);
    const ref = created.body.reference as string;

    const pub = await http().get(`/v1/payment-requests/${ref}/public`).expect(200);
    expect(pub.body).toMatchObject({ reference: ref, currency: "HKD", amountMinor: "5000", status: "OPEN", payee: "HK FinHub customer" });
    expect(JSON.stringify(pub.body)).not.toContain(alice.accountId);
    expect(JSON.stringify(pub.body)).not.toContain(alice.userId);

    const paid = await http().post(`/v1/payment-requests/${ref}/pay`).set(authed(bob)).send({ method: "card", country: "HK", idempotencyKey: `pay-${randomUUID()}` }).expect(201);
    expect(paid.body.clientSecret).toMatch(/_secret_/);
    const intent = lastKey(ctx.fake.state.intents);
    ctx.fake.state.intents.set(intent, "succeeded");
    await stripeWebhook(ctx, "payment_intent.succeeded", intent, { }).expect(200);

    expect(await balanceOf(t, alice.accountId, "HKD", "AVAILABLE")).toBe(5000n);
    expect(await balanceOf(t, bob.accountId, "HKD", "AVAILABLE")).toBe(0n);
    const list = await http().get("/v1/payment-requests").set(authed(alice)).expect(200);
    expect(list.body.items[0].status).toBe("PAID");

    const again = await http().post(`/v1/payment-requests/${ref}/pay`).set(authed(bob)).send({ method: "card", country: "HK", idempotencyKey: `pay2-${randomUUID()}` });
    expect(again.body.error.code).toBe("REQUEST_NOT_OPEN");
  });

  it("requires the payer to state the amount on an open-amount request, and refuses a different amount on a fixed one", async () => {
    const alice = await registerCustomer(t, "req-open");
    const bob = await registerCustomer(t, "req-payer");
    const open = await http().post("/v1/payment-requests").set(authed(alice)).send({ currency: "HKD", memo: "Any amount" }).expect(201);
    const missing = await http().post(`/v1/payment-requests/${open.body.reference}/pay`).set(authed(bob)).send({ method: "card", country: "HK", idempotencyKey: `m-${randomUUID()}` });
    expect(missing.body.error.code).toBe("INVALID_REQUEST");
    const fixed = await http().post("/v1/payment-requests").set(authed(alice)).send({ currency: "HKD", amountMinor: "2000", memo: "Fixed" }).expect(201);
    const wrong = await http().post(`/v1/payment-requests/${fixed.body.reference}/pay`).set(authed(bob)).send({ method: "card", country: "HK", amountMinor: "3000", idempotencyKey: `w-${randomUUID()}` });
    expect(wrong.body.error.code).toBe("INVALID_REQUEST");
  });

  it("lets the owner cancel an open request, but not one that is already paid", async () => {
    const alice = await registerCustomer(t, "req-cancel");
    const r = await http().post("/v1/payment-requests").set(authed(alice)).send({ currency: "HKD", amountMinor: "100", memo: "x" }).expect(201);
    await http().post(`/v1/payment-requests/${r.body.reference}/cancel`).set(authed(alice)).expect(200);
    const gone = await http().post(`/v1/payment-requests/${r.body.reference}/pay`).set(authed(alice)).send({ method: "card", country: "HK", idempotencyKey: `c-${randomUUID()}` });
    expect(gone.body.error.code).toBe("REQUEST_NOT_OPEN");
    const other = await registerCustomer(t, "req-notowner");
    const again = await http().post("/v1/payment-requests").set(authed(alice)).send({ currency: "HKD", amountMinor: "100", memo: "y" }).expect(201);
    expect((await http().post(`/v1/payment-requests/${again.body.reference}/cancel`).set(authed(other))).status).toBe(409);
  });

  it("answers 404 for an unknown request reference", async () => {
    const res = await http().get("/v1/payment-requests/REQ-NOSUCH00/public");
    expect(res.status).toBe(404);
  });
});
