/**
 * Shared API contract types for HK FinHub clients (web, mobile, admin).
 * Money is always an integer string of minor units plus a currency code.
 * Never use floats for money on the wire.
 */

export const CURRENCIES = ["HKD", "USD", "INR", "EUR", "GBP", "AED", "SGD", "CNY"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export interface Money {
  /** Integer minor units, encoded as a decimal string (BigInt-safe). */
  amountMinor: string;
  currency: CurrencyCode;
}

export type KycStatus = "not_started" | "documents_pending" | "under_review" | "verified" | "rejected" | "additional_info_required";

export interface CurrencyBalance {
  currency: CurrencyCode;
  available: Money;
  pending: Money;
  total: Money;
}

export interface CashAccount {
  id: string;
  name: string;
  kind: "wallet" | "trading_cash" | "demat";
  reference: string;
  balance: Money;
}

export interface InvestmentValuation {
  /** Market value of holdings. Shown separately from cash everywhere. */
  marketValue: Money;
  unrealisedPnl: Money;
  unrealisedPnlPct: number;
  asOf: string;
  /** Source label, e.g. the broker name, or "Not connected". */
  source: string;
}

export interface DashboardSummary {
  baseCurrency: CurrencyCode;
  /** Cash total in base currency. */
  cashTotal: Money;
  investmentValue: InvestmentValuation;
  accounts: CashAccount[];
  totals: { deposits: Money; withdrawals: Money; transfers: Money };
  kyc: KycStatus;
  dataSource: "unavailable" | "live";
}

export type TransactionKind = "received" | "sent" | "deposit" | "withdrawal" | "trade" | "fx" | "fee";
export type TransactionStatus = "pending" | "posted" | "failed" | "reversed";

export interface Transaction {
  id: string;
  kind: TransactionKind;
  title: string;
  counterparty?: string;
  amount: Money;
  /** Positive = credit to customer, negative = debit. Derived from ledger direction. */
  signedAmountMinor: string;
  status: TransactionStatus;
  occurredAt: string;
  reference: string;
}

export interface MarketQuote {
  symbol: string;
  name: string;
  market: "HK" | "US" | "IN" | "GLOBAL";
  price: number;
  currency: CurrencyCode;
  changePct: number;
  /** ISO time the quote was produced, and whether it is delayed. */
  asOf: string;
  delayed: boolean;
  source: string;
}

export interface FxQuote {
  id: string;
  from: CurrencyCode;
  to: CurrencyCode;
  /** Rate expressed as units of `to` per 1 unit of `from`. */
  rate: number;
  provider: string;
  quotedAt: string;
  expiresAt: string;
  serviceFee: Money;
  recipientAmount: Money;
}

export interface Beneficiary {
  id: string;
  name: string;
  country: string;
  method: "upi" | "bank" | "swift";
  destination: string;
  currency: CurrencyCode;
}

export interface Holding {
  symbol: string;
  name: string;
  market: MarketQuote["market"];
  quantity: number;
  avgCost: number;
  lastPrice: number;
  currency: CurrencyCode;
  changePct: number;
}

export type OrderSide = "buy" | "sell";
export type OrderState = "open" | "partially_filled" | "filled" | "cancelled" | "rejected";

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  filled: number;
  limitPrice: number | null;
  state: OrderState;
  placedAt: string;
  currency: CurrencyCode;
}

export interface PortfolioPoint {
  date: string;
  value: number;
}

export interface NotificationItem {
  id: string;
  category: "security" | "payment" | "transfer" | "kyc" | "trade" | "system";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface DeviceSession {
  id: string;
  name: string;
  platform: "web" | "ios" | "android";
  lastActive: string;
  location: string;
  current: boolean;
}

export interface TransferRequest {
  beneficiaryId: string;
  amountMinor: string;
  currency: CurrencyCode;
  idempotencyKey: string;
}

export interface TransferReceipt {
  reference: string;
  /** Always "pending" until a verified provider confirmation exists. */
  status: "pending" | "posted" | "failed";
  message: string;
}

/** The single API boundary used by all customer clients. */
export interface FinHubApi {
  getDashboard(): Promise<DashboardSummary>;
  listTransactions(): Promise<Transaction[]>;
  getFxQuote(from: CurrencyCode, to: CurrencyCode, amountMinor: string): Promise<FxQuote | null>;
  getFxHistory(from: CurrencyCode, to: CurrencyCode): Promise<PortfolioPoint[]>;
  listBeneficiaries(): Promise<Beneficiary[]>;
  submitTransfer(req: TransferRequest): Promise<TransferReceipt>;
  listMarket(): Promise<MarketQuote[]>;
  listHoldings(): Promise<Holding[]>;
  listOrders(): Promise<Order[]>;
  getPortfolioHistory(): Promise<PortfolioPoint[]>;
  listNotifications(): Promise<NotificationItem[]>;
  listDevices(): Promise<DeviceSession[]>;
  listCurrencyBalances(): Promise<CurrencyBalance[]>;
  getPriceHistory(symbol: string): Promise<PortfolioPoint[]>;
}
