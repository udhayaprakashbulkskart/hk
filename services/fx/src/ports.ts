/** Rates are integers scaled by RATE_SCALE: 0.1282 is stored as 12_820_000. Never a float. */
export const RATE_SCALE = 100_000_000n;

export interface FxProvider {
  readonly id: string;
  /** Units of `to` per one unit of `from`, scaled by RATE_SCALE, as quoted now. */
  rate(from: string, to: string): Promise<{ rateScaled: bigint; quotedAt: Date }>;
  /** Daily history for the pair, oldest first. */
  history(from: string, to: string, days: number): Promise<{ date: string; rateScaled: bigint }[]>;
}

export interface FxQuoteRecord {
  id: string;
  accountId: string;
  fromCurrency: string;
  toCurrency: string;
  amountMinor: bigint;
  feeMinor: bigint;
  recipientMinor: bigint;
  rateScaled: bigint;
  provider: string;
  quotedAt: Date;
  expiresAt: Date;
  executedAt: Date | null;
  ledgerTransactionId: string | null;
}

export interface FxStore {
  insertQuote(q: Omit<FxQuoteRecord, "executedAt" | "ledgerTransactionId">): Promise<void>;
  findQuote(id: string): Promise<FxQuoteRecord | null>;
  /** Marks a quote used exactly once, while it is unexpired. Returns false if already used or expired. */
  claimQuote(id: string, now: Date, ledgerTransactionId: string | null): Promise<boolean>;
  /** Lets the caller run a function holding a per-account lock, so reservations and spending serialise. */
  withAccountLock<T>(accountId: string, fn: () => Promise<T>): Promise<T>;
}
