import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyCheckoutSignature, verifyWebhookSignature } from "@/lib/razorpay";

const secret = "test_secret";
const sign = (s: string, k = secret) => createHmac("sha256", k).update(s).digest("hex");

describe("razorpay signatures", () => {
  it("accepts a valid checkout signature", () => {
    expect(verifyCheckoutSignature("order_1", "pay_1", sign("order_1|pay_1"), secret)).toBe(true);
  });
  it("rejects tampered ids, wrong secrets and missing secrets", () => {
    const sig = sign("order_1|pay_1");
    expect(verifyCheckoutSignature("order_2", "pay_1", sig, secret)).toBe(false);
    expect(verifyCheckoutSignature("order_1", "pay_1", sign("order_1|pay_1", "other"), secret)).toBe(false);
    expect(verifyCheckoutSignature("order_1", "pay_1", sig, undefined)).toBe(false);
    expect(verifyCheckoutSignature("order_1", "pay_1", "short", secret)).toBe(false);
  });
  it("verifies webhook bodies byte-for-byte", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    expect(verifyWebhookSignature(body, sign(body), secret)).toBe(true);
    expect(verifyWebhookSignature(body + " ", sign(body), secret)).toBe(false);
    expect(verifyWebhookSignature(body, "", secret)).toBe(false);
  });
});
