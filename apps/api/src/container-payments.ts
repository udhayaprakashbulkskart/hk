import { createAdyenAdapter } from "@hkfinhub/integration-adyen";
import { createRazorpayAdapter } from "@hkfinhub/integration-razorpay";
import { createRazorpayXAdapter } from "@hkfinhub/integration-razorpayx";
import { createStripeAdapter } from "@hkfinhub/integration-stripe";
import { createPartnerStub } from "@hkfinhub/integration-partner-stubs";
import { createUnavailableFxProvider, FxService, type FxProvider } from "@hkfinhub/fx";
import { PaymentService, type HttpTransport, type ProviderAdapter, type ProviderId } from "@hkfinhub/payments";
import { PrismaFxStore, PrismaPaymentStore, PrismaRequestStore, PrismaTransferStore, type Database } from "@hkfinhub/database";
import { TransferService, type OutboundGuard } from "@hkfinhub/transfers";
import type { LedgerService } from "@hkfinhub/ledger";
import type { AccountsService } from "@hkfinhub/accounts";
import type { ApiConfig } from "./config";

export interface PaymentServices {
  payments: PaymentService;
  fx: FxService;
  transfers: TransferService;
  requests: PrismaRequestStore;
}

/** Real HTTP transport for provider calls. Tests never use it. */
export const fetchTransport: HttpTransport = {
  async request({ method, url, headers, body }) {
    const init: RequestInit = { method, headers, signal: AbortSignal.timeout(15_000) };
    if (body !== undefined) init.body = body;
    const res = await fetch(url, init);
    return { status: res.status, body: await res.text() };
  },
};

export function buildPaymentServices(args: {
  db: Database;
  config: ApiConfig;
  ledger: LedgerService;
  accounts: AccountsService;
  transport?: HttpTransport | undefined;
  guard?: OutboundGuard | undefined;
  fxProvider?: FxProvider | undefined;
}): PaymentServices {
  const { db, config, ledger, accounts } = args;
  const transport = args.transport ?? fetchTransport;
  const env = config.paymentEnvironment;

  const adapters = new Map<ProviderId, ProviderAdapter>();
  const p = config.providers;
  if (p.razorpay) adapters.set("razorpay", createRazorpayAdapter({ ...p.razorpay, environment: env, transport }));
  if (p.razorpayx) adapters.set("razorpayx", createRazorpayXAdapter({ ...p.razorpayx, environment: env, transport }));
  if (p.stripe) adapters.set("stripe", createStripeAdapter({ secretKey: p.stripe.secretKey, webhookSecret: p.stripe.webhookSecret, environment: env, transport }));
  if (p.adyen) adapters.set("adyen", createAdyenAdapter({ apiKey: p.adyen.apiKey, hmacKeyHex: p.adyen.hmacKeyHex, merchantAccount: p.adyen.merchantAccount, environment: env, transport, returnUrl: config.paymentReturnUrl }));
  adapters.set("upi_bank_partner", createPartnerStub("upi_bank_partner", "D4"));
  adapters.set("intl_payout_partner", createPartnerStub("intl_payout_partner", "D5"));
  adapters.set("ppi_partner", createPartnerStub("ppi_partner", "D6"));

  const fxStore = new PrismaFxStore(db);
  const fx = new FxService(fxStore, args.fxProvider ?? createUnavailableFxProvider(), ledger);
  const requests = new PrismaRequestStore(db);

  // The payments service and the transfers service depend on each other: payments reports outcomes,
  // transfers starts payouts. The listener below is resolved after both exist.
  let transfers!: TransferService;
  const listener = {
    onPayoutSucceeded: (payment: Parameters<TransferService["onPayoutSucceeded"]>[0]) => transfers.onPayoutSucceeded(payment),
    onPayoutFailed: (payment: Parameters<TransferService["onPayoutFailed"]>[0], reason: string) => transfers.onPayoutFailed(payment, reason),
    onCollectionSucceeded: (payment: Parameters<TransferService["onCollectionSucceeded"]>[0]) => transfers.onCollectionSucceeded(payment),
  };
  const payments = new PaymentService(
    new PrismaPaymentStore(db),
    adapters,
    ledger,
    { environment: env, liveFeatureEnabled: config.liveFeaturePayments },
    listener,
  );
  transfers = new TransferService({
    store: new PrismaTransferStore(db),
    requests,
    ledger,
    payments,
    fx,
    accounts,
    config: { environment: env, liveTransfersEnabled: config.liveFeatureTransfers },
    guard: args.guard,
  });
  return { payments, fx, transfers, requests };
}

