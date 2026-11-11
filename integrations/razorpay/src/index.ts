import { createHmac } from "node:crypto";
import { PaymentError, WebhookSignatureError, safeEqualString, type CollectionRequest, type Environment, type Headers, type HttpTransport, type ProviderAdapter, type WebhookEvent } from "@hkfinhub/payments";

export interface RazorpayOptions {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  environment: Environment;
  transport: HttpTransport;
  baseUrl?: string;
}

/**
 * Razorpay collections (INR, UPI and cards). Collections are orders: the customer pays the order and
 * Razorpay sends webhooks. Request shapes follow Razorpay's public API; they must be confirmed in the
 * sandbox before live use (decision D7).
 */
export function createRazorpayAdapter(opts: RazorpayOptions): ProviderAdapter {
  const base = opts.baseUrl ?? "https://api.razorpay.com/v1";
  const auth = `Basic ${Buffer.from(`${opts.keyId}:${opts.keySecret}`).toString("base64")}`;
  return {
    id: "razorpay",
    environment: opts.environment,

    async createCollection(req: CollectionRequest) {
      const res = await opts.transport.request({
        method: "POST",
        url: `${base}/orders`,
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(req.amountMinor), currency: req.currency, receipt: req.reference, notes: req.metadata }),
      });
      if (res.status >= 300) throw new PaymentError("PROVIDER_ERROR", `razorpay order failed (${res.status})`);
      const order = JSON.parse(res.body) as { id: string };
      return { providerRef: order.id };
    },

    async createPayout() {
      throw new PaymentError("ROUTE_NOT_ENABLED", "payouts go through razorpayx");
    },

    async fetchStatus(kind, providerRef) {
      if (kind !== "COLLECTION") throw new PaymentError("INVALID_REQUEST", "razorpay handles collections only");
      const res = await opts.transport.request({ method: "GET", url: `${base}/orders/${encodeURIComponent(providerRef)}`, headers: { Authorization: auth } });
      if (res.status >= 300) throw new PaymentError("PROVIDER_ERROR", `razorpay order lookup failed (${res.status})`);
      const order = JSON.parse(res.body) as { status: string };
      return { status: order.status === "paid" ? "SUCCEEDED" : "PENDING" };
    },

    verifyWebhook(rawBody: Buffer, headers: Headers) {
      const sig = headers["x-razorpay-signature"];
      if (!sig) throw new WebhookSignatureError("missing x-razorpay-signature");
      const expected = createHmac("sha256", opts.webhookSecret).update(rawBody).digest("hex");
      if (!safeEqualString(expected, sig)) throw new WebhookSignatureError();
    },

    parseWebhook(rawBody: Buffer, headers: Headers): WebhookEvent[] {
      const body = JSON.parse(rawBody.toString("utf8")) as { event: string; payload?: { payment?: { entity?: { order_id?: string } } } };
      const eventId = headers["x-razorpay-event-id"];
      if (!eventId) throw new WebhookSignatureError("missing x-razorpay-event-id");
      const orderId = body.payload?.payment?.entity?.order_id;
      if (!orderId) return [];
      return [{ eventId, type: body.event, kind: "COLLECTION", providerRef: orderId }];
    },
  };
}
