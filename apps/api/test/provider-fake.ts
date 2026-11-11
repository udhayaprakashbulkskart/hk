import { createHmac, randomBytes } from "node:crypto";
import type { HttpTransport } from "@hkfinhub/payments";
import { adyenSigningString } from "@hkfinhub/integration-adyen";

/**
 * Fake providers for tests. Tests set what each provider reports; no network is ever used.
 * Every request is recorded so tests can check what was (and was not) sent.
 */
export interface SentRequest { method: string; url: string; headers: Record<string, string>; body?: string }

export function createFakeProviders() {
  const state = {
    orders: new Map<string, string>(),
    payouts: new Map<string, string>(),
    intents: new Map<string, string>(),
    refunded: new Map<string, number>(),
    reject: new Set<string>(),
    sent: [] as SentRequest[],
  };
  const id = (p: string) => `${p}_${randomBytes(7).toString("hex")}`;

  const transport: HttpTransport = {
    async request(req) {
      state.sent.push({ method: req.method, url: req.url, headers: req.headers, ...(req.body !== undefined ? { body: req.body } : {}) });
      const url = req.url;
      const ok = (body: unknown) => ({ status: 200, body: JSON.stringify(body) });
      if ([...state.reject].some((p) => url.includes(p))) return { status: 500, body: "{}" };
      if (url.includes("api.razorpay.com/v1/orders") && req.method === "POST") {
        const oid = id("order");
        state.orders.set(oid, "created");
        return ok({ id: oid, status: "created" });
      }
      const orderGet = url.match(/\/v1\/orders\/([^/?]+)$/);
      if (orderGet && req.method === "GET") return ok({ id: orderGet[1], status: state.orders.get(orderGet[1]!) ?? "created" });
      if (url.endsWith("/v1/contacts")) return ok({ id: id("cont") });
      if (url.endsWith("/v1/fund_accounts")) return ok({ id: id("fa") });
      if (url.endsWith("/v1/payouts") && req.method === "POST") {
        const pid = id("pout");
        state.payouts.set(pid, "queued");
        return ok({ id: pid, status: "queued" });
      }
      const payoutGet = url.match(/\/v1\/payouts\/([^/?]+)$/);
      if (payoutGet && req.method === "GET") return ok({ id: payoutGet[1], status: state.payouts.get(payoutGet[1]!) ?? "queued" });
      if (url.endsWith("api.stripe.com/v1/payment_intents") || url.endsWith("/v1/payment_intents")) {
        if (req.method === "POST") {
          const pi = id("pi");
          state.intents.set(pi, "requires_payment_method");
          return ok({ id: pi, client_secret: `${pi}_secret_${randomBytes(6).toString("hex")}` });
        }
      }
      const piGet = url.match(/\/v1\/payment_intents\/([^/?]+)/);
      if (piGet && req.method === "GET") {
        const pid = piGet[1]!;
        return ok({ id: pid, status: state.intents.get(pid) ?? "requires_payment_method", latest_charge: { amount_refunded: state.refunded.get(pid) ?? 0 } });
      }
      if (url.includes("/v71/sessions")) return ok({ id: id("CS"), sessionData: "adyen-session-test" });
      return { status: 404, body: "{}" };
    },
  };

  return { transport, state };
}

/** Razorpay: hex HMAC-SHA256 of the raw body with the webhook secret. */
export function signRazorpay(body: string, secret = "whsec_razorpay_test"): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/** Stripe: "t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<body>">". */
export function signStripe(body: string, t: number, secret = "whsec_stripe_test"): string {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}

/** Adyen: base64 HMAC-SHA256 of Adyen's signing string, keyed with the hex HMAC key. */
export function signAdyen(item: Parameters<typeof adyenSigningString>[0], keyHex = "44782DEF547AAA06C910C43932B1EB0C71FC68D9D0C057550C48EC2ACF6BA056"): string {
  return createHmac("sha256", Buffer.from(keyHex, "hex")).update(adyenSigningString(item)).digest("base64");
}
