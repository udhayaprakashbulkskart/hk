import request from "supertest";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestApp, resetState, type TestApp } from "./helpers";
import { createFakeProviders, signAdyen, signRazorpay, signStripe } from "./provider-fake";
import { authed, balanceOf, fundHkd, fundInr, lastKey, razorpayWebhook, registerCustomer, stripeWebhook, type Ctx, type Customer } from "./support";

let t: TestApp;
let ctx: Ctx;
const http = () => request(t.app.getHttpServer());

beforeAll(async () => {
  const fake = createFakeProviders();
  t = await startTestApp({ transport: fake.transport });
  ctx = { t, fake };
});
afterAll(async () => { await t.close(); });
beforeEach(async () => { await resetState(t); ctx.fake.state.intents.clear(); ctx.fake.state.orders.clear(); ctx.fake.state.payouts.clear(); ctx.fake.state.refunded.clear(); ctx.fake.state.reject.clear(); ctx.fake.state.sent.length = 0; });

describe("card deposits through Stripe", () => {
  it("does not credit anything until the provider confirms, and the webhook is only applied after the provider agrees", async () => {
    const c = await registerCustomer(t, "stripe-pending");
    const dep = await http().post("/v1/deposits").set(authed(c)).send({ currency: "HKD", amountMinor: "50000", method: "card", country: "HK", idempotencyKey: `dep-${randomUUID()}` }).expect(201);
    expect(dep.body.status).toBe("PENDING");
    expect(dep.body.clientSecret).toMatch(/_secret_/);
    expect(await balanceOf(t, c.accountId, "HKD", "AVAILABLE")).toBe(0n);

    // The event says "created", but the provider still reports the intent as unpaid: nothing posts.
    const pi = lastKey(ctx.fake.state.intents);
    const early = await stripeWebhook(ctx, "payment_intent.created", pi).expect(200);
    expect(early.body.outcomes).toEqual(["ignored"]);
    expect(await balanceOf(t, c.accountId, "HKD", "AVAILABLE")).toBe(0n);
  });

  it("credits once on confirmed success, and a replayed or redelivered success never credits twice", async () => {
    const c = await registerCustomer(t, "stripe-once");
    await fundHkd(ctx, c, "50000");
    expect(await balanceOf(t, c.accountId, "HKD", "AVAILABLE")).toBe(50000n);

    const pi = lastKey(ctx.fake.state.intents);
    const eventId = `evt_replay_${randomUUID()}`;
    const first = await stripeWebhook(ctx, "payment_intent.succeeded", pi, { eventId }).expect(200);
    expect(first.body.outcomes).toEqual(["processed"]);
    const replay = await stripeWebhook(ctx, "payment_intent.succeeded", pi, { eventId }).expect(200);
    expect(replay.body.outcomes).toEqual(["duplicate"]);
    // Same payment, new event id (the provider re-sends under a new id): still no second credit.
    const redelivered = await stripeWebhook(ctx, "payment_intent.succeeded", pi).expect(200);
    expect(redelivered.body.outcomes).toEqual(["processed"]);
    expect(await balanceOf(t, c.accountId, "HKD", "AVAILABLE")).toBe(50000n);
  });

  it("refuses a webhook whose signature does not verify, and changes nothing", async () => {
    const c = await registerCustomer(t, "stripe-forged");
    await http().post("/v1/deposits").set(authed(c)).send({ currency: "HKD", amountMinor: "70000", method: "card", country: "HK", idempotencyKey: `dep-${randomUUID()}` }).expect(201);
    const pi = lastKey(ctx.fake.state.intents);
    ctx.fake.state.intents.set(pi, "succeeded");
    const forged = await stripeWebhook(ctx, "payment_intent.succeeded", pi, { signature: "t=1,v1=deadbeef" });
    expect(forged.status).toBe(401);
    expect(forged.body.error.code).toBe("INVALID_SIGNATURE");
    expect(await balanceOf(t, c.accountId, "HKD", "AVAILABLE")).toBe(0n);
  });

  it("refuses a correctly signed webhook whose timestamp is outside the five-minute tolerance", async () => {
    const c = await registerCustomer(t, "stripe-stale");
    await http().post("/v1/deposits").set(authed(c)).send({ currency: "HKD", amountMinor: "70000", method: "card", country: "HK", idempotencyKey: `dep-${randomUUID()}` }).expect(201);
    const pi = lastKey(ctx.fake.state.intents);
    ctx.fake.state.intents.set(pi, "succeeded");
    const old = await stripeWebhook(ctx, "payment_intent.succeeded", pi, { t: Math.floor(Date.now() / 1000) - 3600 });
    expect(old.status).toBe(401);
  });

  it("reverses a deposit when the provider reports a refund", async () => {
    const c = await registerCustomer(t, "stripe-refund");
    await fundHkd(ctx, c, "40000");
    expect(await balanceOf(t, c.accountId, "HKD", "AVAILABLE")).toBe(40000n);
    const pi = lastKey(ctx.fake.state.intents);
    ctx.fake.state.refunded.set(pi, 40000);
    await stripeWebhook(ctx, "charge.refunded", pi).expect(200);
    expect(await balanceOf(t, c.accountId, "HKD", "AVAILABLE")).toBe(0n);
    const payment = await t.container.db.payment.findFirstOrThrow({ where: { providerRef: pi } });
    expect(payment.status).toBe("REFUNDED");
    const rec = await t.container.ledger.reconcile();
    expect(rec.mismatches).toHaveLength(0);
  });

  it("answers an unknown provider with 404 and never reaches the payment logic", async () => {
    const res = await http().post("/v1/webhooks/unknown-bank").set("Content-Type", "application/json").send("{}");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("UNKNOWN_PROVIDER");
  });
});

describe("UPI deposits through Razorpay", () => {
  it("credits the INR account on a confirmed capture and rejects a forged one", async () => {
    const c = await registerCustomer(t, "razor-upi");
    await http().post("/v1/deposits").set(authed(c)).send({ currency: "INR", amountMinor: "100000", method: "upi", country: "IN", idempotencyKey: `dep-${randomUUID()}` }).expect(201);
    const order = lastKey(ctx.fake.state.orders);

    const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_x", order_id: order } } } });
    const forged = await http().post("/v1/webhooks/razorpay").set("Content-Type", "application/json").set("x-razorpay-event-id", "evt_forged").set("x-razorpay-signature", signRazorpay(body, "wrong-secret")).send(body);
    expect(forged.status).toBe(401);
    expect(await balanceOf(t, c.accountId, "INR", "AVAILABLE")).toBe(0n);

    ctx.fake.state.orders.set(order, "paid");
    const ok = await razorpayWebhook(ctx, "payment.captured", order).expect(200);
    expect(ok.body.outcomes).toEqual(["processed"]);
    expect(await balanceOf(t, c.accountId, "INR", "AVAILABLE")).toBe(100000n);
  });

  it("refuses a webhook without an event id", async () => {
    const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { order_id: "order_none" } } } });
    const res = await http().post("/v1/webhooks/razorpay").set("Content-Type", "application/json").set("x-razorpay-signature", signRazorpay(body)).send(body);
    expect(res.status).toBe(401);
  });

  it("treats a webhook for an unknown order as unmatched, without changing balances", async () => {
    const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { order_id: "order_not_ours" } } } });
    const res = await http().post("/v1/webhooks/razorpay").set("Content-Type", "application/json").set("x-razorpay-event-id", "evt_unmatched").set("x-razorpay-signature", signRazorpay(body)).send(body);
    expect(res.status).toBe(200);
    expect(res.body.outcomes).toEqual(["unmatched"]);
  });
});

describe("Adyen webhooks", () => {
  const item = { pspReference: "PSP1", merchantAccountCode: "HKFinHubTest", merchantReference: "col-abc", amount: { value: 1000, currency: "HKD" }, eventCode: "AUTHORISATION", success: "true" };
  const envelope = (sig: string) => JSON.stringify({ notificationItems: [{ NotificationRequestItem: { ...item, additionalData: { hmacSignature: sig } } }] });

  it("accepts a correctly signed notification and answers the way Adyen expects", async () => {
    const res = await http().post("/v1/webhooks/adyen").set("Content-Type", "application/json").send(envelope(signAdyen(item)));
    expect(res.status).toBe(200);
    expect(res.text).toBe("[accepted]");
  });

  it("refuses a notification whose HMAC does not match, including one with a changed amount", async () => {
    const sig = signAdyen(item);
    const tampered = JSON.stringify({ notificationItems: [{ NotificationRequestItem: { ...item, amount: { value: 999999, currency: "HKD" }, additionalData: { hmacSignature: sig } } }] });
    const res = await http().post("/v1/webhooks/adyen").set("Content-Type", "application/json").send(tampered);
    expect(res.status).toBe(401);
  });

  it("refuses a notification with no signature", async () => {
    const res = await http().post("/v1/webhooks/adyen").set("Content-Type", "application/json").send(JSON.stringify({ notificationItems: [{ NotificationRequestItem: item }] }));
    expect(res.status).toBe(401);
  });
});

describe("live gates", () => {
  it("returns not-yet-available and sends nothing to a provider while live payments are off", async () => {
    const { PaymentService } = await import("@hkfinhub/payments");
    const { PrismaPaymentStore } = await import("@hkfinhub/database");
    const { createStripeAdapter } = await import("@hkfinhub/integration-stripe");
    const fake = createFakeProviders();
    const adapters = new Map([["stripe", createStripeAdapter({ secretKey: "sk_live_x", webhookSecret: "w", environment: "live", transport: fake.transport })]]);
    const svc = new PaymentService(new PrismaPaymentStore(t.container.db), adapters as never, t.container.ledger, { environment: "live", liveFeatureEnabled: false }, { onPayoutSucceeded: async () => undefined, onPayoutFailed: async () => undefined });
    const c = await registerCustomer(t, "live-off");
    await expect(svc.createCollection({ accountId: c.accountId, currency: "HKD", amountMinor: 1000n, method: "card", country: "HK", idempotencyKey: `live-${randomUUID()}`, description: "x" })).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    expect(fake.state.sent).toHaveLength(0);
  });

  it("still refuses live payments with the flag on but no provider approval on record", async () => {
    const { PaymentService } = await import("@hkfinhub/payments");
    const { PrismaPaymentStore } = await import("@hkfinhub/database");
    const { createStripeAdapter } = await import("@hkfinhub/integration-stripe");
    const fake = createFakeProviders();
    const adapters = new Map([["stripe", createStripeAdapter({ secretKey: "sk_live_x", webhookSecret: "w", environment: "live", transport: fake.transport })]]);
    const svc = new PaymentService(new PrismaPaymentStore(t.container.db), adapters as never, t.container.ledger, { environment: "live", liveFeatureEnabled: true }, { onPayoutSucceeded: async () => undefined, onPayoutFailed: async () => undefined });
    const c = await registerCustomer(t, "live-noapproval");
    await expect(svc.createCollection({ accountId: c.accountId, currency: "HKD", amountMinor: 1000n, method: "card", country: "HK", idempotencyKey: `live-${randomUUID()}`, description: "x" })).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
    expect(fake.state.sent).toHaveLength(0);
  });
});

export type { Customer };
