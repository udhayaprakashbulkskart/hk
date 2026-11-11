import { randomUUID } from "node:crypto";
import { LedgerService } from "@hkfinhub/ledger";
import { LAUNCH_CURRENCIES, isLaunchCurrency } from "@hkfinhub/shared";
import { RATE_SCALE, type FxProvider, type FxQuoteRecord, type FxStore } from "./ports";

export class FxError extends Error {
  constructor(readonly code: "INVALID_REQUEST" | "CURRENCY_NOT_SUPPORTED" | "QUOTE_NOT_FOUND" | "QUOTE_EXPIRED" | "QUOTE_ALREADY_USED" | "INSUFFICIENT_FUNDS", message: string) {
    super(message);
    this.name = "FxError";
  }
}

export interface FxConfig {
  /** Service fee in basis points of the source amount. 20 = 0.20%. */
  feeBps: bigint;
  /** How long a quote holds its rate. */
  quoteTtlSeconds: number;
}

export const DEFAULT_FX_CONFIG: FxConfig = { feeBps: 20n, quoteTtlSeconds: 30 };

/**
 * Currency quotes and conversions. All arithmetic is integer: the fee is rounded up in minor units, and
 * the recipient amount is rounded down, so the platform never gives away a fraction of a unit.
 */
export class FxService {
  constructor(
    private readonly store: FxStore,
    private readonly provider: FxProvider,
    private readonly ledger: LedgerService,
    private readonly config: FxConfig = DEFAULT_FX_CONFIG,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async quote(input: { accountId: string; from: string; to: string; amountMinor: bigint }): Promise<FxQuoteRecord> {
    if (!isLaunchCurrency(input.from) || !isLaunchCurrency(input.to)) throw new FxError("CURRENCY_NOT_SUPPORTED", "currency is not offered");
    if (input.from === input.to) throw new FxError("INVALID_REQUEST", "choose two different currencies");
    if (input.amountMinor <= 0n) throw new FxError("INVALID_REQUEST", "amount must be positive");
    const { rateScaled, quotedAt } = await this.provider.rate(input.from, input.to);
    const feeMinor = ceilDiv(input.amountMinor * this.config.feeBps, 10_000n);
    const recipientMinor = ((input.amountMinor - feeMinor) * rateScaled) / RATE_SCALE;
    const record = {
      id: randomUUID(),
      accountId: input.accountId,
      fromCurrency: input.from,
      toCurrency: input.to,
      amountMinor: input.amountMinor,
      feeMinor,
      recipientMinor,
      rateScaled,
      provider: this.provider.id,
      quotedAt,
      expiresAt: new Date(quotedAt.getTime() + this.config.quoteTtlSeconds * 1000),
    };
    await this.store.insertQuote(record);
    return { ...record, executedAt: null, ledgerTransactionId: null };
  }

  /**
   * Converts using a quote. Each currency posts as its own balanced leg, so the ledger's per-currency
   * check holds. The customer's spendable balance must cover the amount after reservations.
   */
  async convert(input: { accountId: string; quoteId: string; reservedMinor: (accountId: string, currency: string) => Promise<bigint> }): Promise<{ quote: FxQuoteRecord; ledgerTransactionId: string }> {
    const quote = await this.store.findQuote(input.quoteId);
    if (!quote || quote.accountId !== input.accountId) throw new FxError("QUOTE_NOT_FOUND", "quote not found");
    if (quote.executedAt) throw new FxError("QUOTE_ALREADY_USED", "this quote has already been used");
    const now = this.now();
    if (quote.expiresAt <= now) throw new FxError("QUOTE_EXPIRED", "this quote has expired; request a new one");

    return this.store.withAccountLock(input.accountId, async () => {
      const available = await this.ledger.getBalances([(await this.ledger.customerAccount(input.accountId, quote.fromCurrency, "AVAILABLE")).id]);
      const balance = [...available.values()][0] ?? 0n;
      const reserved = await input.reservedMinor(input.accountId, quote.fromCurrency);
      if (balance - reserved < quote.amountMinor) throw new FxError("INSUFFICIENT_FUNDS", "insufficient funds for this conversion");

      const [fromAvail, fromFx, fromFees, toFx, toAvail] = await Promise.all([
        this.ledger.customerAccount(input.accountId, quote.fromCurrency, "AVAILABLE"),
        this.ledger.platformAccount(quote.fromCurrency, "FX_POSITION"),
        this.ledger.platformAccount(quote.fromCurrency, "FEES"),
        this.ledger.platformAccount(quote.toCurrency, "FX_POSITION"),
        this.ledger.customerAccount(input.accountId, quote.toCurrency, "AVAILABLE"),
      ]);
      const netFrom = quote.amountMinor - quote.feeMinor;
      const posted = await this.ledger.post({
        kind: "FX_CONVERSION",
        idempotencyKey: `fx-${quote.id}`,
        description: `Currency conversion ${quote.fromCurrency} to ${quote.toCurrency}`,
        reference: quote.id,
        entries: [
          { accountId: fromAvail.id, side: "DEBIT", amountMinor: quote.amountMinor, currency: quote.fromCurrency },
          { accountId: fromFx.id, side: "CREDIT", amountMinor: netFrom, currency: quote.fromCurrency },
          { accountId: fromFees.id, side: "CREDIT", amountMinor: quote.feeMinor, currency: quote.fromCurrency },
          { accountId: toFx.id, side: "DEBIT", amountMinor: quote.recipientMinor, currency: quote.toCurrency },
          { accountId: toAvail.id, side: "CREDIT", amountMinor: quote.recipientMinor, currency: quote.toCurrency },
        ],
      });
      const claimed = await this.store.claimQuote(quote.id, now, posted.transaction.id);
      if (!claimed) throw new FxError("QUOTE_ALREADY_USED", "this quote has already been used");
      return { quote: { ...quote, executedAt: now, ledgerTransactionId: posted.transaction.id }, ledgerTransactionId: posted.transaction.id };
    });
  }

  /**
   * Locks a quote's rate for a transfer. The quote must still be unexpired, and it can be claimed only once.
   * The conversion itself posts later, at settlement, using the rate recorded here.
   */
  async claimForTransfer(input: { accountId: string; quoteId: string }): Promise<FxQuoteRecord> {
    const quote = await this.store.findQuote(input.quoteId);
    if (!quote || quote.accountId !== input.accountId) throw new FxError("QUOTE_NOT_FOUND", "quote not found");
    if (quote.executedAt) throw new FxError("QUOTE_ALREADY_USED", "this quote has already been used");
    const now = this.now();
    if (quote.expiresAt <= now) throw new FxError("QUOTE_EXPIRED", "this quote has expired; request a new one");
    const claimed = await this.store.claimQuote(quote.id, now, null);
    if (!claimed) throw new FxError("QUOTE_ALREADY_USED", "this quote has already been used");
    return { ...quote, executedAt: now };
  }

  async history(from: string, to: string, days = 30) {
    if (!isLaunchCurrency(from) || !isLaunchCurrency(to) || from === to) throw new FxError("INVALID_REQUEST", "choose two different supported currencies");
    return this.provider.history(from, to, Math.min(Math.max(days, 1), 90));
  }

  get currencies(): readonly string[] {
    return LAUNCH_CURRENCIES;
  }
}

function ceilDiv(a: bigint, b: bigint): bigint {
  return (a + b - 1n) / b;
}
