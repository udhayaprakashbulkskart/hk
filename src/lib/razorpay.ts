import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ApiError } from "./errors";

/**
 * Minimal Razorpay REST client. Secrets are read from server env only and never sent to
 * the browser — the client only ever receives the public key id and a Razorpay order id.
 */
const API_BASE = () => process.env.RAZORPAY_API_BASE || "https://api.razorpay.com/v1";

export function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function publicKeyId() {
  return process.env.RAZORPAY_KEY_ID ?? "";
}

function authHeader() {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new ApiError(503, "Online payments are not configured yet. Please pay with your wallet balance.");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE()}${path}`, {
    method,
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) {
    console.error("[razorpay]", method, path, res.status, json?.error);
    throw new ApiError(502, json?.error?.description || "Payment gateway error. Please try again.");
  }
  return json;
}

export type RzpOrder = { id: string; amount: number; currency: string; status: string; receipt: string };
export type RzpPayment = { id: string; order_id: string; amount: number; currency: string; status: string; method?: string; error_description?: string };
export type RzpRefund = { id: string; payment_id: string; amount: number; status: string };

export const createRazorpayOrder = (amount: number, receipt: string, notes: Record<string, string> = {}) =>
  call<RzpOrder>("POST", "/orders", { amount, currency: "INR", receipt, notes, payment_capture: 1 });

export const fetchRazorpayPayment = (paymentId: string) => call<RzpPayment>("GET", `/payments/${encodeURIComponent(paymentId)}`);

export const captureRazorpayPayment = (paymentId: string, amount: number) =>
  call<RzpPayment>("POST", `/payments/${encodeURIComponent(paymentId)}/capture`, { amount, currency: "INR" });

export const refundRazorpayPayment = (paymentId: string, amount: number, notes: Record<string, string> = {}) =>
  call<RzpRefund>("POST", `/payments/${encodeURIComponent(paymentId)}/refund`, { amount, notes, speed: "normal" });

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Checkout signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, secret = process.env.RAZORPAY_KEY_SECRET) {
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhook signature: HMAC_SHA256(raw_body, webhook_secret). */
export function verifyWebhookSignature(rawBody: string, signature: string, secret = process.env.RAZORPAY_WEBHOOK_SECRET) {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
