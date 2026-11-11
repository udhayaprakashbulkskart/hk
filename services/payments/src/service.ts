import { createHash } from "node:crypto";
import type { LedgerService } from "@hkfinhub/ledger";
import { PaymentError, WebhookSignatureError } from "./errors";
import type { Direction, Environment, PaymentListener, PaymentMethod, PaymentRecord, PaymentStore, ProviderAdapter, ProviderId, ProviderStatus, PaymentStatus } from "./ports";

export interface PaymentsConfig {
  /** Environment the platform runs in. Live requires FEATURE_LIVE_PAYMENTS and a ProviderApproval row. */
  environment: Environment;
  liveFeatureEnabled: boolean;
}

export interface CreateCollectionInput {
  accountId: string;
  currency: string;
  amountMinor: bigint;
  method: PaymentMethod;
  country: string;
  idempotencyKey: string;
  description: string;
  metadata?: Record<string, string>;
}

export interface CreatePayoutInput {
  accountId: string;
  currency: string;
  amountMinor: bigint;
  method: "upi" | "bank" | "swift";
  country: string;
  idempotencyKey: string;
  transferId: string;
  beneficiary: { name: string; country: string; method: "upi" | "bank" | "swift"; destination: string };
  description: string;
}

export type WebhookOutcome = "processed" | "duplicate" | "unmatched" | "ignored";

/**
 * Payment orchestration: routes to an enabled provider, creates collections and payouts, and applies
 * verified provider outcomes to the ledger.
 *
 * Rules:
 *  - Nothing reaches a live provider unless the environment is live, FEATURE_LIVE_PAYMENTS is on and a
 *    ProviderApproval row exists for that provider.
 *  - A webhook is applied only after its signature verifies AND the provider confirms the status.
 *  - Status changes are compare-and-set, and ledger postings use deterministic keys. Reprocessing the
 *    same webhook is therefore safe, and an interrupted run recovers on redelivery.
 */
export class PaymentService {
  constructor(
    private readonly store: PaymentStore,
    private readonly adapters: Map<ProviderId, ProviderAdapter>,
    private readonly ledger: LedgerService,
    private readonly config: PaymentsConfig,
    private readonly listener: PaymentListener,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  // ------------------------------------------------------------------ outbound requests

  async createCollection(input: CreateCollectionInput) {
    const existing = await this.store.findByIdempotencyKey(input.idempotencyKey);
    if (existing) return { payment: existing, replayed: true, checkoutUrl: undefined as string | undefined, instructions: undefined as string | undefined, clientSecret: undefined as string | undefined };
    if (input.amountMinor <= 0n) throw new PaymentError("INVALID_REQUEST", "amount must be positive");
    this.assertLiveFeature();
    const route = await this.route("COLLECTION", input.country, input.currency, input.method);
    const adapter = this.adapterFor(route.providerId, route.environment);
    await this.assertLive(route.providerId, route.environment);

    const reference = `col-${shortHash(input.idempotencyKey)}`;
    const now = this.clock();
    const payment = await this.store.insertPayment({
      direction: "COLLECTION",
      providerId: route.providerId,
      environment: route.environment,
      reference,
      idempotencyKey: input.idempotencyKey,
      accountId: input.accountId,
      currency: input.currency,
      amountMinor: input.amountMinor,
      method: input.method,
      country: input.country,
      transferId: null,
      metadata: input.metadata ?? {},
      now,
    });
    try {
      const created = await adapter.createCollection({
        reference,
        amountMinor: input.amountMinor,
        currency: input.currency as never,
        description: input.description,
        metadata: { ...(input.metadata ?? {}), reference, paymentId: payment.id },
      });
      await this.store.setProviderRef(payment.id, created.providerRef, "PENDING", this.clock());
      return { payment: { ...payment, providerRef: created.providerRef, status: "PENDING" as const }, replayed: false, checkoutUrl: created.checkoutUrl, instructions: created.instructions, clientSecret: created.clientSecret };
    } catch (err) {
      await this.store.moveStatus(payment.id, ["CREATED"], "FAILED", this.clock(), "provider rejected the request");
      throw new PaymentError("PROVIDER_ERROR", "the payment provider could not accept this request");
    }
  }

  /** Submits a payout. The caller has already reserved the funds on the transfer. */
  async createPayout(input: CreatePayoutInput): Promise<{ payment: PaymentRecord; replayed: boolean }> {
    const existing = await this.store.findByIdempotencyKey(input.idempotencyKey);
    if (existing) return { payment: existing, replayed: true };
    if (input.amountMinor <= 0n) throw new PaymentError("INVALID_REQUEST", "amount must be positive");
    this.assertLiveFeature();
    const route = await this.route("PAYOUT", input.country, input.currency, input.method);
    const adapter = this.adapterFor(route.providerId, route.environment);
    await this.assertLive(route.providerId, route.environment);

    const reference = `pay-${shortHash(input.idempotencyKey)}`;
    const payment = await this.store.insertPayment({
      direction: "PAYOUT",
      providerId: route.providerId,
      environment: route.environment,
      reference,
      idempotencyKey: input.idempotencyKey,
      accountId: input.accountId,
      currency: input.currency,
      amountMinor: input.amountMinor,
      method: input.method,
      country: input.country,
      transferId: input.transferId,
      metadata: {},
      now: this.clock(),
    });
    try {
      const sent = await adapter.createPayout({ reference, amountMinor: input.amountMinor, currency: input.currency as never, description: input.description, beneficiary: input.beneficiary });
      await this.store.setProviderRef(payment.id, sent.providerRef, "SUBMITTED", this.clock());
      return { payment: { ...payment, providerRef: sent.providerRef, status: "SUBMITTED" }, replayed: false };
    } catch {
      await this.store.moveStatus(payment.id, ["CREATED"], "FAILED", this.clock(), "provider rejected the payout");
      await this.listener.onPayoutFailed({ ...payment, status: "FAILED" }, "provider rejected the payout");
      throw new PaymentError("PROVIDER_ERROR", "the payment provider could not accept this payout");
    }
  }

  // ------------------------------------------------------------------ inbound webhooks

  /** Verifies, deduplicates, confirms with the provider, then applies. Safe to call repeatedly for one event. */
  async processWebhook(providerId: ProviderId, rawBody: Buffer, headers: Record<string, string | undefined>): Promise<{ outcomes: WebhookOutcome[] }> {
    const adapter = this.adapters.get(providerId);
    if (!adapter) throw new PaymentError("UNKNOWN_PROVIDER", `no adapter for ${providerId}`);
    const now = this.clock();
    adapter.verifyWebhook(rawBody, headers, now); // throws WebhookSignatureError
    const events = adapter.parseWebhook(rawBody, headers);
    const outcomes: WebhookOutcome[] = [];

    for (const ev of events) {
      const { record, created } = await this.store.upsertWebhook({ providerId, eventId: ev.eventId, type: ev.type, payload: { type: ev.type, providerRef: ev.providerRef, eventId: ev.eventId }, now });
      if (!created && record.processedAt) {
        outcomes.push("duplicate");
        continue;
      }
      const payment = await this.store.findByProviderRef(providerId, ev.providerRef);
      if (!payment) {
        await this.store.markWebhookProcessed(record.id, "unmatched", this.clock());
        outcomes.push("unmatched");
        continue;
      }
      // The provider is asked directly. The webhook says something happened; the status says what.
      const truth = await adapter.fetchStatus(ev.kind, ev.providerRef);
      const outcome = await this.apply(payment, truth.status);
      await this.store.markWebhookProcessed(record.id, outcome, this.clock());
      outcomes.push(outcome === "ignored" ? "ignored" : "processed");
    }
    return { outcomes };
  }

  /** Applies a confirmed provider status. Every step is idempotent, so a repeat changes nothing new. */
  private async apply(payment: PaymentRecord, status: ProviderStatus): Promise<string> {
    const now = this.clock();
    if (payment.direction === "COLLECTION") {
      if (status === "SUCCEEDED") {
        await this.store.moveStatus(payment.id, ["PENDING", "CREATED"], "SUCCEEDED", now);
        const current = (await this.store.findPayment(payment.id))!;
        if (current.status === "SUCCEEDED" || current.status === "REFUNDED") {
          await this.postCollection(current);
          return "processed";
        }
        return "ignored";
      }
      if (status === "FAILED") {
        const moved = await this.store.moveStatus(payment.id, ["PENDING", "CREATED"], "FAILED", now, "provider reported failure");
        return moved ? "processed" : "ignored";
      }
      if (status === "REFUNDED") {
        const moved = await this.store.moveStatus(payment.id, ["SUCCEEDED"], "REFUNDED", now);
        if (!moved) return "ignored";
        const current = (await this.store.findPayment(payment.id))!;
        if (current.ledgerTransactionId) {
          await this.ledger.reverse(current.ledgerTransactionId, { idempotencyKey: `refund-${payment.id}` });
        }
        return "processed";
      }
      return "ignored";
    }
    // PAYOUT
    if (status === "SUCCEEDED") {
      const moved = await this.store.moveStatus(payment.id, ["SUBMITTED", "CREATED"], "SUCCEEDED", now);
      const current = (await this.store.findPayment(payment.id))!;
      if (moved || current.status === "SUCCEEDED") {
        await this.listener.onPayoutSucceeded(current);
        return "processed";
      }
      return "ignored";
    }
    if (status === "FAILED") {
      const moved = await this.store.moveStatus(payment.id, ["SUBMITTED", "CREATED"], "FAILED", now, "provider reported failure");
      if (moved) await this.listener.onPayoutFailed({ ...payment, status: "FAILED" }, "provider reported failure");
      return moved ? "processed" : "ignored";
    }
    return "ignored";
  }

  private async postCollection(payment: PaymentRecord): Promise<void> {
    const result = await this.ledger.recordVerifiedDeposit({
      customerId: payment.accountId,
      currency: payment.currency as never,
      amountMinor: payment.amountMinor,
      providerRef: `${payment.providerId}:${payment.providerRef ?? payment.reference}`,
      idempotencyKey: `collection-${payment.id}`,
    });
    if (!payment.ledgerTransactionId) {
      await this.store.setLedgerTransaction(payment.id, result.transaction.id, this.clock());
    }
    await this.listener.onCollectionSucceeded?.({ ...payment, ledgerTransactionId: result.transaction.id });
  }

  // ------------------------------------------------------------------ routing and gates

  private async route(direction: Direction, country: string, currency: string, method: PaymentMethod): Promise<{ providerId: ProviderId; environment: Environment }> {
    const environment = this.config.environment;
    const routes = await this.store.findRoutes({ direction, country, currency, method, environment });
    const first = routes[0];
    if (!first && environment === "live") {
      // Live routes ship disabled. Until one is switched on, live money reports "not yet available".
      throw new PaymentError("NOT_AVAILABLE", "live payments are not yet available");
    }
    if (!first) throw new PaymentError("ROUTE_NOT_ENABLED", `no enabled ${direction.toLowerCase()} route for ${method} ${currency} from ${country}`);
    return { providerId: first.providerId, environment };
  }

  private adapterFor(providerId: ProviderId, environment: Environment): ProviderAdapter {
    const adapter = this.adapters.get(providerId);
    if (!adapter || adapter.environment !== environment) throw new PaymentError("UNKNOWN_PROVIDER", `${providerId} is not configured for ${environment}`);
    return adapter;
  }

  /** First gate: while the feature flag is off, live requests stop before anything is routed. */
  private assertLiveFeature(): void {
    if (this.config.environment === "live" && !this.config.liveFeatureEnabled) {
      throw new PaymentError("NOT_AVAILABLE", "live payments are not yet available");
    }
  }

  /** Second gate: a recorded provider approval for this provider and environment. */
  private async assertLive(providerId: ProviderId, environment: Environment): Promise<void> {
    if (environment !== "live") return;
    const approved = await this.store.hasProviderApproval(providerId, environment);
    if (!approved) throw new PaymentError("NOT_AVAILABLE", "live payments are not yet available for this provider");
  }
}

export function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export { WebhookSignatureError };
export type { PaymentStatus };
