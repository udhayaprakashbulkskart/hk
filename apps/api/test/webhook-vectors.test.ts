import { describe, expect, it } from "vitest";
import { WebhookSignatureError, type Headers } from "@hkfinhub/payments";
import { createRazorpayAdapter } from "@hkfinhub/integration-razorpay";
import { createRazorpayXAdapter } from "@hkfinhub/integration-razorpayx";
import { createStripeAdapter } from "@hkfinhub/integration-stripe";
import { createAdyenAdapter, adyenEscape, adyenSigningString } from "@hkfinhub/integration-adyen";

/**
 * Signature vectors. The expected values were computed once from each provider's documented algorithm
 * and pinned here, so any change to verification shows up as a failure. They are NOT samples recorded
 * from a provider. Replace them with recorded sandbox samples before live use (decision D7).
 */
const noTransport = { request: async () => ({ status: 500, body: "" }) };
const at = (unix: number) => new Date(unix * 1000);

describe("Razorpay vectors", () => {
  const body = Buffer.from('{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_1","order_id":"order_1"}}}}');
  const adapter = createRazorpayAdapter({ keyId: "k", keySecret: "s", webhookSecret: "whsec_vector", environment: "sandbox", transport: noTransport });
  const good = "3786bd2ccb1c3b15ca4c4519ffe3f1d300251c231aed4a1c6cbe10d4168b0b9f";

  it("accepts the pinned signature", () => {
    expect(() => adapter.verifyWebhook(body, { "x-razorpay-signature": good, "x-razorpay-event-id": "e1" }, at(0))).not.toThrow();
  });
  it("refuses a signature with one character changed, a missing header, and a body that differs by one byte", () => {
    const wrong = good.slice(0, -1) + (good.endsWith("0") ? "1" : "0");
    expect(() => adapter.verifyWebhook(body, { "x-razorpay-signature": wrong }, at(0))).toThrow(WebhookSignatureError);
    expect(() => adapter.verifyWebhook(body, {}, at(0))).toThrow(WebhookSignatureError);
    expect(() => adapter.verifyWebhook(Buffer.from(body.toString().replace("pay_1", "pay_2")), { "x-razorpay-signature": good }, at(0))).toThrow(WebhookSignatureError);
  });
  it("RazorpayX uses the same signature scheme", () => {
    const x = createRazorpayXAdapter({ keyId: "k", keySecret: "s", webhookSecret: "whsec_vector", accountNumber: "1", environment: "sandbox", transport: noTransport });
    expect(() => x.verifyWebhook(body, { "x-razorpay-signature": good }, at(0))).not.toThrow();
  });
});

describe("Stripe vectors", () => {
  const body = Buffer.from('{"id":"evt_1","type":"payment_intent.succeeded","data":{"object":{"id":"pi_1"}}}');
  const adapter = createStripeAdapter({ secretKey: "sk", webhookSecret: "whsec_vector", environment: "sandbox", transport: noTransport });
  const sig = "829f615e1119a4a01880c449982c1a7db02af38275c8099b2f836171cd5fb682";

  it("accepts the pinned signature inside the tolerance window", () => {
    expect(() => adapter.verifyWebhook(body, { "stripe-signature": `t=1700000000,v1=${sig}` }, at(1700000100))).not.toThrow();
  });
  it("accepts when any one of several v1 signatures matches (key rotation)", () => {
    expect(() => adapter.verifyWebhook(body, { "stripe-signature": `t=1700000000,v1=00ff,v1=${sig}` }, at(1700000000))).not.toThrow();
  });
  it("refuses outside the five-minute tolerance, in either direction", () => {
    expect(() => adapter.verifyWebhook(body, { "stripe-signature": `t=1700000000,v1=${sig}` }, at(1700000000 + 301))).toThrow(/tolerance/);
    expect(() => adapter.verifyWebhook(body, { "stripe-signature": `t=1700000000,v1=${sig}` }, at(1700000000 - 301))).toThrow(/tolerance/);
  });
  it("refuses a header with the timestamp removed, or the signature changed", () => {
    expect(() => adapter.verifyWebhook(body, { "stripe-signature": `v1=${sig}` }, at(1700000000))).toThrow(/malformed/);
    expect(() => adapter.verifyWebhook(body, { "stripe-signature": "t=1700000000,v1=ab" }, at(1700000000))).toThrow(WebhookSignatureError);
  });
});

describe("Adyen vectors", () => {
  const key = "44782DEF547AAA06C910C43932B1EB0C71FC68D9D0C057550C48EC2ACF6BA056";
  const adapter = createAdyenAdapter({ apiKey: "k", hmacKeyHex: key, merchantAccount: "M", environment: "sandbox", transport: noTransport, returnUrl: "https://x.example" });
  const item = { pspReference: "PSP1", merchantAccountCode: "M", merchantReference: "col-abc", amount: { value: 1000, currency: "HKD" }, eventCode: "AUTHORISATION", success: "true" };
  const sig = "NUqW3LRnZnv9QnaXhT4RpJ4TRSeEJV7UEJaM3hZqSq4=";

  it("escapes colons and backslashes in the signing string, in Adyen's order", () => {
    expect(adyenEscape("a:b\\c")).toBe("a\\:b\\\\c");
    expect(adyenSigningString({ pspReference: "A:1", merchantAccountCode: "M", merchantReference: "col\\x", amount: { value: 1000, currency: "HKD" }, eventCode: "AUTHORISATION", success: "true" })).toBe("A\\:1::M:col\\\\x:1000:HKD:AUTHORISATION:true");
  });

  it("accepts the pinned HMAC and refuses one with a different amount", () => {
    const body = (amount: number, s: string) => Buffer.from(JSON.stringify({ notificationItems: [{ NotificationRequestItem: { ...item, amount: { value: amount, currency: "HKD" }, additionalData: { hmacSignature: s } } }] }));
    expect(() => adapter.verifyWebhook(body(1000, sig), {}, at(0))).not.toThrow();
    expect(() => adapter.verifyWebhook(body(1001, sig), {}, at(0))).toThrow(WebhookSignatureError);
  });
});
