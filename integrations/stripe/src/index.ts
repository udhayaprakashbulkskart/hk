import { createHmac } from "node:crypto";
import { PaymentError, WebhookSignatureError, safeEqualString, type CollectionRequest, type Environment, type Headers, type HttpTransport, type ProviderAdapter, type ProviderStatus, type WebhookEvent } from "@hkfinhub/payments";


export interface StripeOptions {
  secretKey: string;
  webhookSecret: string;
  environment: Environment;
  transport: HttpTransport;
  baseUrl?: string;
  /** Maximum age of a signed webhook, in seconds. Stripe's default. */
  toleranceSeconds?: number;
}

/**
 * Stripe card and international collections through PaymentIntents. Verifies the Stripe-Signature header
 * (t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<body>">) with a five-minute tolerance.
 */
export function createStripeAdapter(opts: StripeOptions): ProviderAdapter {
  const base = opts.baseUrl ?? "https://api.stripe.com/v1";
  const tolerance = opts.toleranceSeconds ?? 300;
  const auth = `Bearer ${opts.secretKey}`;
  return {
    id: "stripe",
    environment: opts.environment,

    async createCollection(req: CollectionRequest) {
      const form = new URLSearchParams();
      form.set("amount", req.amountMinor.toString());
      form.set("currency", req.currency.toLowerCase());
      form.set("description", req.description.slice(0, 200));
      form.set("automatic_payment_methods[enabled]", "true");
      for (const [k, v] of Object.entries(req.metadata)) form.set(`metadata[${k}]`, v.slice(0, 500));
      const res = await opts.transport.request({ method: "POST", url: `${base}/payment_intents`, headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
      if (res.status >= 300) throw new PaymentError("PROVIDER_ERROR", `stripe payment intent failed (${res.status})`);
      const pi = JSON.parse(res.body) as { id: string; client_secret: string };
      return { providerRef: pi.id, clientSecret: pi.client_secret };
    },

    async createPayout() {
      throw new PaymentError("ROUTE_NOT_ENABLED", "stripe does not handle payouts in this platform");
    },

    async fetchStatus(kind, providerRef): Promise<{ status: ProviderStatus }> {
      if (kind !== "COLLECTION") throw new PaymentError("INVALID_REQUEST", "stripe handles collections only");
      const res = await opts.transport.request({ method: "GET", url: `${base}/payment_intents/${encodeURIComponent(providerRef)}?expand[]=latest_charge`, headers: { Authorization: auth } });
      if (res.status >= 300) throw new PaymentError("PROVIDER_ERROR", `stripe lookup failed (${res.status})`);
      const pi = JSON.parse(res.body) as { status: string; latest_charge?: { amount_refunded?: number } | null };
      if (pi.status !== "succeeded") return { status: pi.status === "canceled" ? "FAILED" : "PENDING" };
      if ((pi.latest_charge?.amount_refunded ?? 0) > 0) return { status: "REFUNDED" };
      return { status: "SUCCEEDED" };
    },

    verifyWebhook(rawBody: Buffer, headers: Headers, now: Date) {
      const header = headers["stripe-signature"];
      if (!header) throw new WebhookSignatureError("missing Stripe-Signature");
      const parts = header.split(",").map((p) => p.split("=") as [string, string]);
      const t = parts.find(([k]) => k === "t")?.[1];
      const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
      if (!t || signatures.length === 0) throw new WebhookSignatureError("malformed Stripe-Signature");
      const age = Math.abs(now.getTime() / 1000 - Number(t));
      if (!Number.isFinite(age) || age > tolerance) throw new WebhookSignatureError("webhook timestamp outside tolerance");
      const expected = createHmac("sha256", opts.webhookSecret).update(`${t}.`).update(rawBody).digest("hex");
      if (!signatures.some((s) => safeEqualString(expected, s))) throw new WebhookSignatureError();
    },

    parseWebhook(rawBody: Buffer): WebhookEvent[] {
      const evt = JSON.parse(rawBody.toString("utf8")) as { id: string; type: string; data: { object: { id?: string; payment_intent?: string } } };
      const obj = evt.data.object;
      const pi = evt.type.startsWith("charge.") ? obj.payment_intent : obj.id;
      if (!pi || !pi.startsWith("pi_")) return [];
      return [{ eventId: evt.id, type: evt.type, kind: "COLLECTION", providerRef: pi }];
    },
  };
}
