export type PaymentErrorCode =
  | "NOT_AVAILABLE"
  | "ROUTE_NOT_ENABLED"
  | "UNKNOWN_PROVIDER"
  | "PAYMENT_NOT_FOUND"
  | "IDEMPOTENCY_CONFLICT"
  | "PROVIDER_ERROR"
  | "INVALID_REQUEST";

export class PaymentError extends Error {
  constructor(readonly code: PaymentErrorCode, message: string) {
    super(message);
    this.name = "PaymentError";
  }
}

/** A webhook whose signature does not verify. Never processed, never acknowledged as processed. */
export class WebhookSignatureError extends Error {
  constructor(message = "webhook signature is not valid") {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

import { timingSafeEqual } from "node:crypto";

/** Constant-time string comparison for signatures. Length mismatch is a plain false. */
export function safeEqualString(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}
