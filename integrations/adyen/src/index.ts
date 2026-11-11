import { createHmac, timingSafeEqual } from "node:crypto";
import { PaymentError, WebhookSignatureError, type CollectionRequest, type Environment, type Headers, type HttpTransport, type ProviderAdapter, type ProviderStatus, type WebhookEvent } from "@hkfinhub/payments";

export interface AdyenOptions {
  apiKey: string;
  hmacKeyHex: string;
  merchantAccount: string;
  environment: Environment;
  transport: HttpTransport;
  checkoutBaseUrl?: string;
  returnUrl: string;
}

/** Escapes a field for Adyen's HMAC input: backslash first, then colon. */
export function adyenEscape(value: string | undefined): string {
  return (value ?? "").replace(/\\/g, "\\\\").replace(/:/g, "\\:");
}

/** The string Adyen signs for a notification item, in Adyen's documented field order. */
export function adyenSigningString(item: {
  pspReference?: string; originalReference?: string; merchantAccountCode?: string; merchantReference?: string;
  amount?: { value?: number; currency?: string }; eventCode?: string; success?: string;
}): string {
  return [
    item.pspReference, item.originalReference, item.merchantAccountCode, item.merchantReference,
    item.amount?.value !== undefined ? String(item.amount.value) : "", item.amount?.currency,
    item.eventCode, item.success,
  ].map(adyenEscape).join(":");
}

/**
 * Adyen card and global collections through Sessions. Webhooks (notification items) carry an HMAC in
 * additionalData.hmacSignature. Status is only ever read from webhooks here, so fetchStatus is refused:
 * Adyen collections stay disabled for money until a status lookup is implemented and sandbox-tested.
 */
export function createAdyenAdapter(opts: AdyenOptions): ProviderAdapter {
  const base = opts.checkoutBaseUrl ?? "https://checkout-test.adyen.com/v71";
  return {
    id: "adyen",
    environment: opts.environment,

    async createCollection(req: CollectionRequest) {
      const res = await opts.transport.request({
        method: "POST",
        url: `${base}/sessions`,
        headers: { "X-API-Key": opts.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: { value: Number(req.amountMinor), currency: req.currency },
          reference: req.reference,
          merchantAccount: opts.merchantAccount,
          returnUrl: opts.returnUrl,
          countryCode: "HK",
        }),
      });
      if (res.status >= 300) throw new PaymentError("PROVIDER_ERROR", `adyen session failed (${res.status})`);
      const session = JSON.parse(res.body) as { id: string; sessionData: string };
      return { providerRef: req.reference, instructions: session.sessionData };
    },

    async createPayout() {
      throw new PaymentError("ROUTE_NOT_ENABLED", "adyen payouts are not enabled");
    },

    async fetchStatus(): Promise<{ status: ProviderStatus }> {
      throw new PaymentError("NOT_AVAILABLE", "adyen status lookup is not implemented; collections stay disabled");
    },

    verifyWebhook(rawBody: Buffer) {
      const body = JSON.parse(rawBody.toString("utf8")) as { notificationItems?: { NotificationRequestItem?: Record<string, unknown> & { additionalData?: { hmacSignature?: string } } }[] };
      const items = body.notificationItems ?? [];
      if (items.length === 0) throw new WebhookSignatureError("no notification items");
      const key = Buffer.from(opts.hmacKeyHex, "hex");
      for (const wrapper of items) {
        const item = wrapper.NotificationRequestItem as Parameters<typeof adyenSigningString>[0] & { additionalData?: { hmacSignature?: string } };
        const sig = item?.additionalData?.hmacSignature;
        if (!sig) throw new WebhookSignatureError("missing hmacSignature");
        const expected = createHmac("sha256", key).update(adyenSigningString(item)).digest("base64");
        const a = Buffer.from(expected);
        const b = Buffer.from(sig);
        if (a.length !== b.length || !timingSafeEqual(a, b)) throw new WebhookSignatureError();
      }
    },

    parseWebhook(rawBody: Buffer): WebhookEvent[] {
      const body = JSON.parse(rawBody.toString("utf8")) as { notificationItems?: { NotificationRequestItem?: { pspReference?: string; eventCode?: string; merchantReference?: string } }[] };
      return (body.notificationItems ?? []).flatMap((w) => {
        const item = w.NotificationRequestItem;
        if (!item?.merchantReference || !item.pspReference || !item.eventCode) return [];
        return [{ eventId: `${item.pspReference}:${item.eventCode}`, type: item.eventCode, kind: "COLLECTION" as const, providerRef: item.merchantReference }];
      });
    },
  };
}
