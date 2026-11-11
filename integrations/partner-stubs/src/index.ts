import { PaymentError, WebhookSignatureError, type ProviderAdapter, type ProviderId } from "@hkfinhub/payments";

/**
 * Placeholders for partners not yet contracted: UPI and bank (D4), international payouts (D5) and the
 * wallet or PPI partner (D6). Each refuses every operation, and their routes stay disabled, so no money
 * can reach them until a real adapter replaces the stub.
 */
export function createPartnerStub(id: Extract<ProviderId, "upi_bank_partner" | "intl_payout_partner" | "ppi_partner">, decision: string): ProviderAdapter {
  const refuse = (): never => {
    throw new PaymentError("NOT_AVAILABLE", `${id} is not yet approved (${decision})`);
  };
  return {
    id,
    environment: "test",
    createCollection: async () => refuse(),
    createPayout: async () => refuse(),
    fetchStatus: async () => refuse(),
    verifyWebhook: () => {
      throw new WebhookSignatureError(`${id} is not yet approved`);
    },
    parseWebhook: () => [],
  };
}
