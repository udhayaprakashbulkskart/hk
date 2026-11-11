import request from "supertest";
import { expect } from "vitest";
import { randomUUID } from "node:crypto";
import { codeSentTo, DEVICE, PASSWORD, type TestApp } from "./helpers";
import { createFakeProviders, signRazorpay, signStripe } from "./provider-fake";

export interface Customer {
  name: string;
  access: string;
  userId: string;
  accountId: string;
}

export interface Ctx {
  t: TestApp;
  fake: ReturnType<typeof createFakeProviders>;
}

let phoneSeed = 0;

/** Registers, verifies and logs in a customer through the real endpoints. */
export async function registerCustomer(t: TestApp, name: string): Promise<Customer> {
  const email = `${name}-${randomUUID().slice(0, 8)}@example.com`;
  const phone = `+8529${String(3000000 + (phoneSeed++ % 6000000)).padStart(7, "0")}`;
  const http = () => request(t.app.getHttpServer());
  await http().post("/v1/auth/register").send({ email, phone, password: PASSWORD, fullName: name, countryCode: "HK", language: "en" }).expect(202);
  await t.drain();
  await http().post("/v1/auth/otp/verify").send({ email, channel: "EMAIL", code: codeSentTo(t.email, email) }).expect(200);
  await http().post("/v1/auth/otp/verify").send({ email, channel: "SMS", code: codeSentTo(t.sms, phone) }).expect(200);
  const login = await http().post("/v1/auth/login").send({ email, password: PASSWORD, device: DEVICE }).expect(200);
  const access = login.body.tokens.accessToken as string;
  await http().get("/v1/accounts").set("Authorization", `Bearer ${access}`).expect(200);
  const me = await http().get("/v1/me").set("Authorization", `Bearer ${access}`).expect(200);
  const account = await t.container.db.account.findUniqueOrThrow({ where: { userId: me.body.id } });
  return { name, access, userId: me.body.id, accountId: account.id };
}

export const authed = (c: Customer) => ({ Authorization: `Bearer ${c.access}` });

/** A Stripe (HK card) deposit, confirmed by the provider and delivered as a signed webhook. */
export async function fundHkd(ctx: Ctx, c: Customer, amountMinor: string): Promise<void> {
  const http = () => request(ctx.t.app.getHttpServer());
  const dep = await http().post("/v1/deposits").set(authed(c)).send({ currency: "HKD", amountMinor, method: "card", country: "HK", idempotencyKey: `dep-${randomUUID()}` }).expect(201);
  expect(dep.body.status).toBe("PENDING");
  const pi = lastKey(ctx.fake.state.intents);
  ctx.fake.state.intents.set(pi, "succeeded");
  await stripeWebhook(ctx, "payment_intent.succeeded", pi).expect(200);
}

/** A Razorpay (INR, UPI) deposit, confirmed and delivered as a signed webhook. */
export async function fundInr(ctx: Ctx, c: Customer, amountMinor: string): Promise<void> {
  const http = () => request(ctx.t.app.getHttpServer());
  await http().post("/v1/deposits").set(authed(c)).send({ currency: "INR", amountMinor, method: "upi", country: "IN", idempotencyKey: `dep-${randomUUID()}` }).expect(201);
  const order = lastKey(ctx.fake.state.orders);
  ctx.fake.state.orders.set(order, "paid");
  await razorpayWebhook(ctx, "payment.captured", order).expect(200);
}

export function stripeWebhook(ctx: Ctx, type: string, pi: string, opts: { eventId?: string; t?: number; signature?: string } = {}) {
  const body = JSON.stringify({ id: opts.eventId ?? `evt_${randomUUID()}`, type, data: { object: { id: pi, payment_intent: pi } } });
  const t = opts.t ?? Math.floor(Date.now() / 1000);
  return request(ctx.t.app.getHttpServer())
    .post("/v1/webhooks/stripe")
    .set("Content-Type", "application/json")
    .set("Stripe-Signature", opts.signature ?? signStripe(body, t))
    .send(body);
}

export function razorpayWebhook(ctx: Ctx, event: string, order: string, opts: { eventId?: string; signature?: string } = {}) {
  const body = JSON.stringify({ event, payload: { payment: { entity: { id: `pay_${randomUUID()}`, order_id: order, status: "captured" } } } });
  return request(ctx.t.app.getHttpServer())
    .post("/v1/webhooks/razorpay")
    .set("Content-Type", "application/json")
    .set("x-razorpay-event-id", opts.eventId ?? `evt_${randomUUID()}`)
    .set("x-razorpay-signature", opts.signature ?? signRazorpay(body))
    .send(body);
}

export function razorpayXWebhook(ctx: Ctx, event: string, payout: string, eventId = `evt_${randomUUID()}`) {
  const body = JSON.stringify({ event, payload: { payout: { entity: { id: payout } } } });
  return request(ctx.t.app.getHttpServer())
    .post("/v1/webhooks/razorpayx")
    .set("Content-Type", "application/json")
    .set("x-razorpay-event-id", eventId)
    .set("x-razorpay-signature", signRazorpay(body))
    .send(body);
}

export function lastKey<V>(m: Map<string, V>): string {
  const keys = [...m.keys()];
  const last = keys[keys.length - 1];
  if (!last) throw new Error("no provider object created");
  return last;
}

export async function balanceOf(t: TestApp, accountId: string, currency: string, purpose: "AVAILABLE" | "HOLD"): Promise<bigint> {
  const acct = await t.container.ledger.customerAccount(accountId, currency, purpose);
  const row = await t.container.db.ledgerBalance.findUnique({ where: { ledgerAccountId: acct.id } });
  return row?.balanceMinor ?? 0n;
}
