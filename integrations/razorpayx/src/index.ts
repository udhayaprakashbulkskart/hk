import { createHmac } from "node:crypto";
import { PaymentError, WebhookSignatureError, safeEqualString, type Environment, type Headers, type HttpTransport, type PayoutRequest, type ProviderAdapter, type ProviderStatus, type WebhookEvent } from "@hkfinhub/payments";


export interface RazorpayXOptions {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  accountNumber: string;
  environment: Environment;
  transport: HttpTransport;
  baseUrl?: string;
}

/**
 * RazorpayX payouts to India (UPI and bank). A payout needs a contact and a fund account first, then the
 * payout itself. Shapes follow RazorpayX's public API and must be confirmed in the sandbox (decision D7).
 */
export function createRazorpayXAdapter(opts: RazorpayXOptions): ProviderAdapter {
  const base = opts.baseUrl ?? "https://api.razorpay.com/v1";
  const auth = `Basic ${Buffer.from(`${opts.keyId}:${opts.keySecret}`).toString("base64")}`;
  const post = async (path: string, payload: unknown) => {
    const res = await opts.transport.request({ method: "POST", url: `${base}${path}`, headers: { Authorization: auth, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.status >= 300) throw new PaymentError("PROVIDER_ERROR", `razorpayx ${path} failed (${res.status})`);
    return JSON.parse(res.body) as Record<string, unknown>;
  };

  return {
    id: "razorpayx",
    environment: opts.environment,

    async createCollection() {
      throw new PaymentError("ROUTE_NOT_ENABLED", "collections go through razorpay");
    },

    async createPayout(req: PayoutRequest) {
      if (req.beneficiary.method !== "upi" && req.beneficiary.method !== "bank") {
        throw new PaymentError("ROUTE_NOT_ENABLED", "razorpayx pays UPI and bank accounts only");
      }
      const contact = await post("/contacts", { name: req.beneficiary.name, type: "vendor", reference_id: `${req.reference}-c` });
      const fundAccount =
        req.beneficiary.method === "upi"
          ? { account_type: "vpa", contact_id: contact["id"], vpa: { address: req.beneficiary.destination } }
          : { account_type: "bank_account", contact_id: contact["id"], bank_account: { name: req.beneficiary.name, ifsc: "", account_number: req.beneficiary.destination } };
      const fund = await post("/fund_accounts", fundAccount);
      const payout = await post("/payouts", {
        account_number: opts.accountNumber,
        fund_account_id: fund["id"],
        amount: Number(req.amountMinor),
        currency: req.currency,
        mode: req.beneficiary.method === "upi" ? "UPI" : "NEFT",
        purpose: "payout",
        queue_if_low_balance: true,
        reference_id: req.reference,
        narration: req.description.slice(0, 30),
      });
      return { providerRef: String(payout["id"]) };
    },

    async fetchStatus(kind, providerRef): Promise<{ status: ProviderStatus }> {
      if (kind !== "PAYOUT") throw new PaymentError("INVALID_REQUEST", "razorpayx handles payouts only");
      const res = await opts.transport.request({ method: "GET", url: `${base}/payouts/${encodeURIComponent(providerRef)}`, headers: { Authorization: auth } });
      if (res.status >= 300) throw new PaymentError("PROVIDER_ERROR", `razorpayx payout lookup failed (${res.status})`);
      const p = JSON.parse(res.body) as { status: string };
      if (p.status === "processed") return { status: "SUCCEEDED" };
      if (p.status === "rejected" || p.status === "cancelled" || p.status === "reversed") return { status: "FAILED" };
      return { status: "PENDING" };
    },

    verifyWebhook(rawBody: Buffer, headers: Headers) {
      const sig = headers["x-razorpay-signature"];
      if (!sig) throw new WebhookSignatureError("missing x-razorpay-signature");
      const expected = createHmac("sha256", opts.webhookSecret).update(rawBody).digest("hex");
      if (!safeEqualString(expected, sig)) throw new WebhookSignatureError();
    },

    parseWebhook(rawBody: Buffer, headers: Headers): WebhookEvent[] {
      const body = JSON.parse(rawBody.toString("utf8")) as { event: string; payload?: { payout?: { entity?: { id?: string } } } };
      const eventId = headers["x-razorpay-event-id"];
      if (!eventId) throw new WebhookSignatureError("missing x-razorpay-event-id");
      const id = body.payload?.payout?.entity?.id;
      if (!id || !body.event.startsWith("payout.")) return [];
      return [{ eventId, type: body.event, kind: "PAYOUT", providerRef: id }];
    },
  };
}
