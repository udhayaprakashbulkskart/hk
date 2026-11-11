import { randomBytes, randomUUID } from "node:crypto";
import type { AccountsService } from "@hkfinhub/accounts";
import type { FxService } from "@hkfinhub/fx";
import type { LedgerService, TxKind } from "@hkfinhub/ledger";
import type { PaymentListener, PaymentRecord, PaymentService } from "@hkfinhub/payments";
import { PaymentError } from "@hkfinhub/payments";
import { CURRENCY_META, isLaunchCurrency, type LaunchCurrency } from "@hkfinhub/shared";
import { TransferError } from "./errors";
import type { PaymentRequestRecord, RequestStore, TransferKind, TransferRecord, TransferStore } from "./ports";

export interface TransfersConfig {
  environment: "sandbox" | "live";
  liveTransfersEnabled: boolean;
}

export interface Deps {
  store: TransferStore;
  requests: RequestStore;
  ledger: LedgerService;
  payments: PaymentService;
  fx: FxService;
  accounts: AccountsService;
  config: TransfersConfig;
  clock?: () => Date;
}

/**
 * Customer transfers, withdrawals and payment requests.
 *
 * The money rules:
 *  - Starting an outbound transfer RESERVES the amount. Balances do not change: the reservation only
 *    limits what else can be spent. Nothing posts to the ledger until the provider confirms.
 *  - Settlement posts the ledger entries once, keyed to the transfer, when the payout succeeds.
 *  - A failed payout releases the reservation. No money had moved, so nothing needs reversing.
 *  - Every spending path takes the account lock and checks available minus reserved first.
 */
export class TransferService implements PaymentListener {
  private readonly d: Required<Pick<Deps, "clock">> & Deps;

  constructor(deps: Deps) {
    this.d = { clock: () => new Date(), ...deps };
  }

  // ------------------------------------------------------------------ internal transfers

  /** Customer to customer, instantly, on the ledger. Same currency only: convert first. */
  async internal(input: { accountId: string; toAccountRef: string; currency: string; amountMinor: bigint; idempotencyKey: string }) {
    const replay = await this.d.store.findByKey(input.idempotencyKey);
    if (replay) return replay;
    if (!isLaunchCurrency(input.currency)) throw new TransferError("INVALID_REQUEST", `${input.currency} is not offered`);
    if (input.amountMinor <= 0n) throw new TransferError("INVALID_REQUEST", "amount must be positive");
    const recipientAccountId = await this.d.accounts.resolveAccountRef(input.toAccountRef);
    if (!recipientAccountId) throw new TransferError("NOT_FOUND", "no HK FinHub account has that reference");
    if (recipientAccountId === input.accountId) throw new TransferError("INVALID_REQUEST", "you cannot send money to yourself");

    const now = this.d.clock();
    const id = randomUUID();
    return this.d.store.transaction(async (tx) => {
      await tx.lockAccounts([input.accountId, recipientAccountId]);
      await this.assertFunds(tx, input.accountId, input.currency, input.amountMinor);
      const [from, to] = await Promise.all([
        this.d.ledger.customerAccount(input.accountId, input.currency, "AVAILABLE"),
        this.d.ledger.customerAccount(recipientAccountId, input.currency, "AVAILABLE"),
      ]);
      const posted = await this.d.ledger.post({
        kind: "INTERNAL_TRANSFER",
        idempotencyKey: `internal-${id}`,
        description: "Transfer to another HK FinHub account",
        reference: id,
        entries: [
          { accountId: from.id, side: "DEBIT", amountMinor: input.amountMinor, currency: input.currency },
          { accountId: to.id, side: "CREDIT", amountMinor: input.amountMinor, currency: input.currency },
        ],
      });
      const row = await tx.insert({
        id,
        accountId: input.accountId,
        kind: "INTERNAL",
        sourceCurrency: input.currency,
        sourceMinor: input.amountMinor,
        feeMinor: 0n,
        recipientCurrency: input.currency,
        recipientMinor: input.amountMinor,
        fxQuoteId: null,
        recipientAccountId,
        destinationMasked: null,
        method: null,
        country: null,
        idempotencyKey: input.idempotencyKey,
        now,
      });
      await tx.move(row.id, ["INITIATED"], "POSTED", now, { ledgerTransactionId: posted.transaction.id });
      return (await tx.findById(row.id))!;
    });
  }

  // ------------------------------------------------------------------ external payouts

  /** Sends money to a saved recipient, or withdraws to the customer's own bank. */
  async payout(input: {
    accountId: string;
    userId: string;
    beneficiaryId: string;
    sourceCurrency: string;
    amountMinor: bigint;
    idempotencyKey: string;
    kind?: "TRANSFER" | "WITHDRAWAL";
    fxQuoteId?: string | null;
  }): Promise<TransferRecord> {
    const replay = await this.d.store.findByKey(input.idempotencyKey);
    if (replay) return replay;
    this.assertLive();
    if (!isLaunchCurrency(input.sourceCurrency)) throw new TransferError("INVALID_REQUEST", `${input.sourceCurrency} is not offered`);
    if (input.amountMinor <= 0n) throw new TransferError("INVALID_REQUEST", "amount must be positive");

    const details = await this.d.accounts.payoutDetails(input.userId, input.beneficiaryId).catch(() => {
      throw new TransferError("NOT_FOUND", "recipient not found");
    });
    const kind: TransferKind = input.kind ?? "TRANSFER";
    if (kind === "WITHDRAWAL" && details.method !== "bank") throw new TransferError("INVALID_REQUEST", "withdrawals go to a bank account");

    // Cross-currency: the rate is locked by a quote. Same currency: no conversion, no fee.
    let feeMinor = 0n;
    let recipientMinor = input.amountMinor;
    let quoteId: string | null = null;
    if (details.currency !== input.sourceCurrency) {
      if (!input.fxQuoteId) throw new TransferError("INVALID_REQUEST", "a currency quote is needed for this recipient");
      const quote = await this.d.fx.claimForTransfer({ accountId: input.accountId, quoteId: input.fxQuoteId });
      if (quote.fromCurrency !== input.sourceCurrency || quote.toCurrency !== details.currency || quote.amountMinor !== input.amountMinor) {
        throw new TransferError("INVALID_REQUEST", "the quote does not match this transfer");
      }
      feeMinor = quote.feeMinor;
      recipientMinor = quote.recipientMinor;
      quoteId = quote.id;
    }

    const now = this.d.clock();
    const id = randomUUID();
    const reserved = await this.d.store.transaction(async (tx) => {
      await tx.lockAccounts([input.accountId]);
      await this.assertFunds(tx, input.accountId, input.sourceCurrency, input.amountMinor);
      return tx.insert({
        id,
        accountId: input.accountId,
        kind,
        sourceCurrency: input.sourceCurrency,
        sourceMinor: input.amountMinor,
        feeMinor,
        recipientCurrency: details.currency,
        recipientMinor,
        fxQuoteId: quoteId,
        recipientAccountId: null,
        destinationMasked: maskedFrom(details.destination),
        method: details.method,
        country: details.country,
        idempotencyKey: input.idempotencyKey,
        now,
      });
    });

    try {
      const sent = await this.d.payments.createPayout({
        accountId: input.accountId,
        currency: details.currency,
        amountMinor: recipientMinor,
        method: details.method,
        country: details.country,
        idempotencyKey: `payout-${id}`,
        transferId: id,
        beneficiary: { name: details.name, country: details.country, method: details.method, destination: details.destination },
        description: kind === "WITHDRAWAL" ? "Withdrawal to your bank account" : "Transfer from HK FinHub",
      });
      await this.d.store.setPaymentId(id, sent.payment.id, this.d.clock());
      await this.d.store.move(id, ["INITIATED"], "SUBMITTED", this.d.clock());
    } catch (err) {
      const reason = err instanceof PaymentError ? err.message : "the payment could not be submitted";
      await this.d.store.move(id, ["INITIATED"], "FAILED", this.d.clock(), { failureReason: reason });
      if (err instanceof PaymentError && err.code === "NOT_AVAILABLE") throw new TransferError("NOT_AVAILABLE", err.message);
      if (err instanceof PaymentError && err.code === "ROUTE_NOT_ENABLED") throw new TransferError("NOT_AVAILABLE", "this transfer route is not yet available");
      throw new TransferError("NOT_AVAILABLE", reason);
    }
    return (await this.d.store.findById(id))!;
  }

  // ------------------------------------------------------------------ provider outcomes

  /** Provider confirmed the payout. Post the settlement once, then mark the transfer posted. */
  async onPayoutSucceeded(payment: PaymentRecord): Promise<void> {
    // Look up by the link the payment carries. A webhook can arrive before the transfer records its
    // payment id, and the settlement must not be lost in that window.
    const t = payment.transferId ? await this.d.store.findById(payment.transferId) : await this.d.store.findByPaymentId(payment.id);
    if (!t) return;
    if (t.status === "POSTED" || t.status === "FAILED") return; // replay, or already decided
    const posted = await this.postSettlement(t); // keyed to the transfer: safe to repeat
    await this.d.store.move(t.id, ["INITIATED", "SUBMITTED"], "POSTED", this.d.clock(), { ledgerTransactionId: posted });
  }

  /** Provider could not pay out. Nothing was posted, so releasing the reservation is all that is needed. */
  async onPayoutFailed(payment: PaymentRecord, reason: string): Promise<void> {
    const t = payment.transferId ? await this.d.store.findById(payment.transferId) : await this.d.store.findByPaymentId(payment.id);
    if (!t) return;
    await this.d.store.move(t.id, ["INITIATED", "SUBMITTED"], "FAILED", this.d.clock(), { failureReason: reason });
  }

  /** A confirmed collection that pays a payment request closes that request. */
  async onCollectionSucceeded(payment: PaymentRecord): Promise<void> {
    const ref = payment.metadata["requestRef"];
    if (ref) await this.d.requests.markPaid(ref, payment.id, this.d.clock());
  }

  private async postSettlement(t: TransferRecord): Promise<string> {
    const kind: TxKind = t.kind === "WITHDRAWAL" ? "WITHDRAWAL" : "TRANSFER_SETTLE";
    const customer = await this.d.ledger.customerAccount(t.accountId, t.sourceCurrency, "AVAILABLE");
    const legs: { accountId: string; side: "DEBIT" | "CREDIT"; amountMinor: bigint; currency: string }[] = [];
    if (t.sourceCurrency === t.recipientCurrency) {
      const settlement = await this.d.ledger.platformAccount(t.sourceCurrency, "SETTLEMENT");
      legs.push({ accountId: customer.id, side: "DEBIT", amountMinor: t.sourceMinor, currency: t.sourceCurrency });
      legs.push({ accountId: settlement.id, side: "CREDIT", amountMinor: t.sourceMinor, currency: t.sourceCurrency });
    } else {
      const [fxSrc, fees, settleDst, fxDst] = await Promise.all([
        this.d.ledger.platformAccount(t.sourceCurrency, "FX_POSITION"),
        this.d.ledger.platformAccount(t.sourceCurrency, "FEES"),
        this.d.ledger.platformAccount(t.recipientCurrency, "SETTLEMENT"),
        this.d.ledger.platformAccount(t.recipientCurrency, "FX_POSITION"),
      ]);
      legs.push({ accountId: customer.id, side: "DEBIT", amountMinor: t.sourceMinor, currency: t.sourceCurrency });
      legs.push({ accountId: fxSrc.id, side: "CREDIT", amountMinor: t.sourceMinor - t.feeMinor, currency: t.sourceCurrency });
      legs.push({ accountId: fees.id, side: "CREDIT", amountMinor: t.feeMinor, currency: t.sourceCurrency });
      legs.push({ accountId: settleDst.id, side: "DEBIT", amountMinor: t.recipientMinor, currency: t.recipientCurrency });
      legs.push({ accountId: fxDst.id, side: "CREDIT", amountMinor: t.recipientMinor, currency: t.recipientCurrency });
    }
    const result = await this.d.ledger.post({
      kind,
      idempotencyKey: `transfer-settle-${t.id}`,
      description: kind === "WITHDRAWAL" ? "Withdrawal to bank account" : "Transfer sent",
      reference: t.id,
      entries: legs,
    });
    return result.transaction.id;
  }

  // ------------------------------------------------------------------ reads

  /** Amount reserved by transfers still in flight, so other spends see what is already promised. */
  async reservedFor(accountId: string, currency: string): Promise<bigint> {
    return this.d.store.reservedMinor(accountId, currency);
  }

  async list(accountId: string, limit = 20): Promise<TransferRecord[]> {
    return this.d.store.listForAccount(accountId, Math.min(Math.max(limit, 1), 100));
  }

  async get(accountId: string, id: string): Promise<TransferRecord> {
    const t = await this.d.store.findById(id);
    if (!t || t.accountId !== accountId) throw new TransferError("NOT_FOUND", "transfer not found");
    return t;
  }

  // ------------------------------------------------------------------ payment requests

  async createRequest(input: { accountId: string; currency: string; amountMinor?: bigint | null; memo: string }): Promise<PaymentRequestRecord> {
    if (!isLaunchCurrency(input.currency)) throw new TransferError("INVALID_REQUEST", `${input.currency} is not offered`);
    if (input.amountMinor !== undefined && input.amountMinor !== null && input.amountMinor <= 0n) throw new TransferError("INVALID_REQUEST", "amount must be positive");
    const memo = input.memo.trim().slice(0, 80);
    const ref = `REQ-${Array.from(randomBytes(6), (b) => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[b % 32]).join("")}`;
    return this.d.requests.insert({ ref, accountId: input.accountId, currency: input.currency, amountMinor: input.amountMinor ?? null, memo, createdAt: this.d.clock() });
  }

  async listRequests(accountId: string) {
    return this.d.requests.listForAccount(accountId, 50);
  }

  async cancelRequest(accountId: string, ref: string): Promise<void> {
    const ok = await this.d.requests.cancel(ref, accountId);
    if (!ok) throw new TransferError("REQUEST_NOT_OPEN", "this request is not open");
  }

  /** Public view for a payer: no account identifiers, no balances. */
  async publicRequest(ref: string) {
    const r = await this.d.requests.findByRef(ref);
    if (!r) throw new TransferError("NOT_FOUND", "payment request not found");
    return { reference: r.ref, currency: r.currency, amountMinor: r.amountMinor?.toString() ?? null, memo: r.memo, status: r.status, payee: "HK FinHub customer" };
  }

  /** A payer pays an open request. The collection credits the requester's account once the provider confirms. */
  async payRequest(input: { ref: string; method: "upi" | "bank" | "card" | "swift"; country: string; amountMinor?: bigint; idempotencyKey: string }) {
    const r = await this.d.requests.findByRef(input.ref);
    if (!r) throw new TransferError("NOT_FOUND", "payment request not found");
    if (r.status !== "OPEN") throw new TransferError("REQUEST_NOT_OPEN", "this request is no longer open");
    const amount = r.amountMinor ?? input.amountMinor;
    if (!amount || amount <= 0n) throw new TransferError("INVALID_REQUEST", "enter the amount to pay");
    if (r.amountMinor !== null && input.amountMinor !== undefined && input.amountMinor !== r.amountMinor) {
      throw new TransferError("INVALID_REQUEST", "this request is for a fixed amount");
    }
    try {
      return await this.d.payments.createCollection({
        accountId: r.accountId,
        currency: r.currency,
        amountMinor: amount,
        method: input.method,
        country: input.country,
        idempotencyKey: input.idempotencyKey,
        description: `Payment request ${r.ref}`,
        metadata: { requestRef: r.ref },
      });
    } catch (err) {
      if (err instanceof PaymentError) throw new TransferError("NOT_AVAILABLE", err.message);
      throw err;
    }
  }

  // ------------------------------------------------------------------ helpers

  private async assertFunds(tx: TransferStore, accountId: string, currency: string, amountMinor: bigint): Promise<void> {
    const available = await this.d.ledger.getBalances([(await this.d.ledger.customerAccount(accountId, currency, "AVAILABLE")).id]);
    const balance = [...available.values()][0] ?? 0n;
    const reserved = await tx.reservedMinor(accountId, currency);
    if (balance - reserved < amountMinor) throw new TransferError("INSUFFICIENT_FUNDS", "insufficient funds");
  }

  private assertLive(): void {
    if (this.d.config.environment === "live" && !this.d.config.liveTransfersEnabled) {
      throw new TransferError("NOT_AVAILABLE", "live transfers are not yet available");
    }
  }
}

export function maskedFrom(destination: string): string {
  return `${"•".repeat(Math.max(4, Math.min(destination.length - 4, 12)))}${destination.slice(-4)}`;
}

export { CURRENCY_META };
export type { LaunchCurrency };
