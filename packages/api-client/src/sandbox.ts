import {
  CURRENCIES,
  type CurrencyBalance, type Beneficiary, type CurrencyCode, DashboardSummary, DeviceSession, FinHubApi, FxQuote, Holding,
  MarketQuote, NotificationItem, Order, PortfolioPoint, Transaction, TransferReceipt, TransferRequest,
} from "@hkfinhub/types";

/*
 * SANDBOX CLIENT. Every figure here is illustrative sample data, not a customer balance,
 * a live rate or a live market price. It exists so the UI can be built and tested before the
 * real API (Phase 4). Transfers never complete here: they return "pending".
 */

const SAMPLE = "Sample data";
const AS_OF = "2026-11-11T09:30:00+08:00";

const m = (amountMinor: number | string, currency: CurrencyCode = "HKD") => ({ amountMinor: String(amountMinor), currency });

// Sample FX table, units of `to` per one unit of `from`. Replaced by the FX provider in Phase 6.
const SAMPLE_RATES: Record<string, number> = {
  "HKD>USD": 0.1282, "USD>HKD": 7.8, "HKD>INR": 10.71, "INR>HKD": 0.0934, "HKD>EUR": 0.1185, "EUR>HKD": 8.44,
  "HKD>GBP": 0.1011, "GBP>HKD": 9.89, "HKD>AED": 0.4708, "AED>HKD": 2.124, "HKD>SGD": 0.1668, "SGD>HKD": 5.996,
  "HKD>CNY": 0.9176, "CNY>HKD": 1.09, "USD>INR": 83.5, "INR>USD": 0.012, "USD>EUR": 0.92, "EUR>USD": 1.087,
  "USD>GBP": 0.79, "GBP>USD": 1.266, "USD>SGD": 1.3, "SGD>USD": 0.769, "USD>CNY": 7.16, "CNY>USD": 0.1397,
  "USD>AED": 3.6725, "AED>USD": 0.2723, "EUR>GBP": 0.85, "GBP>EUR": 1.176, "EUR>INR": 90.8, "INR>EUR": 0.011,
  "GBP>INR": 105.7, "INR>GBP": 0.00946, "SGD>INR": 64.2, "INR>SGD": 0.01557, "CNY>INR": 11.7, "INR>CNY": 0.0855,
  "AED>INR": 22.75, "INR>AED": 0.044, "SGD>CNY": 5.5, "CNY>SGD": 0.1818,
};

const transactions: Transaction[] = [
  { id: "t1", kind: "received", title: "Received from Alex Chen", counterparty: "Alex Chen", amount: m(500000), signedAmountMinor: "500000", status: "posted", occurredAt: "2026-11-11T10:24:00+08:00", reference: "RCV-20261111-0481" },
  { id: "t2", kind: "trade", title: "Bought AAPL × 10", amount: m(18990, "USD"), signedAmountMinor: "-18990", status: "posted", occurredAt: "2026-11-11T09:40:00+08:00", reference: "ORD-88213" },
  { id: "t3", kind: "sent", title: "Sent to David Wong (SWIFT)", counterparty: "David Wong", amount: m(320000), signedAmountMinor: "-320000", status: "pending", occurredAt: "2026-11-10T18:15:00+08:00", reference: "TRF-20261110-2207" },
  { id: "t4", kind: "deposit", title: "Deposit by bank transfer", amount: m(2000000), signedAmountMinor: "2000000", status: "posted", occurredAt: "2026-11-08T12:02:00+08:00", reference: "DEP-20261108-0031" },
  { id: "t5", kind: "fx", title: "Currency conversion HKD → INR", amount: m(1000000), signedAmountMinor: "-1000000", status: "posted", occurredAt: "2026-11-07T16:48:00+08:00", reference: "FXC-20261107-0119" },
  { id: "t6", kind: "withdrawal", title: "Withdrawal to bank account", amount: m(1200000), signedAmountMinor: "-1200000", status: "failed", occurredAt: "2026-11-05T11:11:00+08:00", reference: "WDR-20261105-0072" },
];

const market: MarketQuote[] = [
  { symbol: "HSI", name: "Hang Seng Index", market: "HK", price: 18928.36, currency: "HKD", changePct: 1.24, asOf: AS_OF, delayed: true, source: SAMPLE },
  { symbol: "HSTECH", name: "Hang Seng TECH", market: "HK", price: 4251.78, currency: "HKD", changePct: 1.67, asOf: AS_OF, delayed: true, source: SAMPLE },
  { symbol: "0700.HK", name: "Tencent Holdings", market: "HK", price: 327.8, currency: "HKD", changePct: 1.92, asOf: AS_OF, delayed: true, source: SAMPLE },
  { symbol: "9988.HK", name: "Alibaba Group", market: "HK", price: 76.35, currency: "HKD", changePct: 1.48, asOf: AS_OF, delayed: true, source: SAMPLE },
  { symbol: "AAPL", name: "Apple Inc.", market: "US", price: 189.98, currency: "USD", changePct: 0.84, asOf: AS_OF, delayed: true, source: SAMPLE },
  { symbol: "TSLA", name: "Tesla Inc.", market: "US", price: 248.5, currency: "USD", changePct: -0.32, asOf: AS_OF, delayed: true, source: SAMPLE },
  { symbol: "RELIANCE.NS", name: "Reliance Industries", market: "IN", price: 2945.4, currency: "INR", changePct: 0.61, asOf: AS_OF, delayed: true, source: SAMPLE },
];

const holdings: Holding[] = [
  { symbol: "0700.HK", name: "Tencent Holdings", market: "HK", quantity: 300, avgCost: 301.2, lastPrice: 327.8, currency: "HKD", changePct: 1.92 },
  { symbol: "9988.HK", name: "Alibaba Group", market: "HK", quantity: 400, avgCost: 79.1, lastPrice: 76.35, currency: "HKD", changePct: 1.48 },
  { symbol: "AAPL", name: "Apple Inc.", market: "US", quantity: 10, avgCost: 176.4, lastPrice: 189.98, currency: "USD", changePct: 0.84 },
];

const orders: Order[] = [
  { id: "ORD-88214", symbol: "TSLA", side: "buy", quantity: 5, filled: 2, limitPrice: 246, state: "partially_filled", placedAt: "2026-11-11T09:52:00+08:00", currency: "USD" },
  { id: "ORD-88213", symbol: "AAPL", side: "buy", quantity: 10, filled: 10, limitPrice: null, state: "filled", placedAt: "2026-11-11T09:40:00+08:00", currency: "USD" },
  { id: "ORD-88190", symbol: "9988.HK", side: "sell", quantity: 100, filled: 0, limitPrice: 80, state: "cancelled", placedAt: "2026-11-09T14:05:00+08:00", currency: "HKD" },
];

const beneficiaries: Beneficiary[] = [
  { id: "ben_1", name: "David Wong", country: "SG", method: "swift", destination: "DBSSSGSG • •••• 5521", currency: "SGD" },
  { id: "ben_2", name: "Priya Raman", country: "IN", method: "upi", destination: "priya•••@upi", currency: "INR" },
  { id: "ben_3", name: "Lin Wei", country: "CN", method: "bank", destination: "Bank of China •••• 0042", currency: "CNY" },
];

const notifications: NotificationItem[] = [
  { id: "n1", category: "payment", title: "Payment received", body: "HKD 5,000.00 from Alex Chen.", createdAt: "2026-11-11T10:24:00+08:00", read: false },
  { id: "n2", category: "trade", title: "Order partially filled", body: "TSLA buy order ORD-88214: 2 of 5 shares filled.", createdAt: "2026-11-11T09:58:00+08:00", read: false },
  { id: "n3", category: "security", title: "New device signed in", body: "A Windows browser signed in to your account.", createdAt: "2026-11-10T21:03:00+08:00", read: true },
  { id: "n4", category: "transfer", title: "Transfer is processing", body: "Transfer TRF-20261110-2207 is awaiting confirmation from our payment partner.", createdAt: "2026-11-10T18:16:00+08:00", read: true },
  { id: "n5", category: "kyc", title: "Identity verified", body: "Your identity verification is complete.", createdAt: "2026-11-02T10:00:00+08:00", read: true },
];

const devices: DeviceSession[] = [
  { id: "d1", name: "Chrome on Windows", platform: "web", lastActive: "Active now", location: "Hong Kong", current: true },
  { id: "d2", name: "iPhone 15", platform: "ios", lastActive: "2 hours ago", location: "Hong Kong", current: false },
  { id: "d3", name: "Pixel 8", platform: "android", lastActive: "3 days ago", location: "Singapore", current: false },
];

const portfolioSeries: PortfolioPoint[] = [
  0.82, 0.84, 0.83, 0.86, 0.9, 0.88, 0.92, 0.95, 0.93, 0.98, 1.01, 0.99, 1.03, 1.06, 1.04, 1.08, 1.1, 1.09, 1.12, 1.15, 1.13, 1.17, 1.19, 1.18, 1.2, 1.23, 1.21, 1.25, 1.27, 1.3,
].map((v, i) => ({ date: new Date(Date.UTC(2026, 9, 13 + i)).toISOString().slice(0, 10), value: Math.round(v * 9_520_300) / 100 }));

function fxHistory(from: CurrencyCode, to: CurrencyCode): PortfolioPoint[] {
  const base = SAMPLE_RATES[`${from}>${to}`] ?? 1;
  return Array.from({ length: 30 }, (_, i) => {
    const wobble = 1 + Math.sin(i / 3.2) * 0.012 + (i - 15) * 0.0004;
    return { date: new Date(Date.UTC(2026, 9, 13 + i)).toISOString().slice(0, 10), value: Number((base * wobble).toPrecision(6)) };
  });
}

/** Convert a sample amount to HKD using the sample rate table. */
function toHkdMinor(amount: number, currency: CurrencyCode): number {
  if (currency === "HKD") return Math.round(amount * 100);
  const rate = SAMPLE_RATES[`${currency}>HKD`] ?? 1;
  return Math.round(amount * rate * 100);
}

function buildDashboard(): DashboardSummary {
  // Investment value is derived from holdings, never typed in separately, so the two always agree.
  const marketValue = holdings.reduce((sum, h) => sum + toHkdMinor(h.quantity * h.lastPrice, h.currency), 0);
  const costBasis = holdings.reduce((sum, h) => sum + toHkdMinor(h.quantity * h.avgCost, h.currency), 0);
  const pnl = marketValue - costBasis;
  const wallet = 12845000;
  const trading = 95203036;
  return {
    baseCurrency: "HKD",
    // Cash only. Investment valuation is deliberately excluded from this total.
    cashTotal: m(wallet + trading),
    investmentValue: {
      marketValue: m(marketValue), unrealisedPnl: m(pnl),
      unrealisedPnlPct: Number(((pnl / costBasis) * 100).toFixed(2)),
      asOf: AS_OF, source: `${SAMPLE} · delayed`,
    },
    accounts: [
      { id: "acc_wallet", name: "Wallet", kind: "wallet", reference: "WLT-•••• 4821", balance: m(wallet) },
      { id: "acc_trading", name: "Trading cash", kind: "trading_cash", reference: "TRD-•••• 0937", balance: m(trading) },
      { id: "acc_demat", name: "Securities holdings", kind: "demat", reference: "BRK-•••• 7710", balance: m(marketValue) },
    ],
    totals: { deposits: m(50000000), withdrawals: m(12000000), transfers: m(8400000) },
    kyc: "verified",
    dataSource: "sandbox",
  };
}

export const sandboxApi: FinHubApi = {
  async getDashboard() { return buildDashboard(); },
  async listTransactions() { return transactions; },
  async getFxQuote(from, to, amountMinor) {
    const rate = SAMPLE_RATES[`${from}>${to}`];
    if (!rate) throw new Error(`No sample rate for ${from}→${to}`);
    const amt = BigInt(amountMinor);
    const fee = (amt * 15n) / 10_000n; // sample 0.15% service fee in source currency
    const net = amt - fee;
    const recipient = (net * BigInt(Math.round(rate * 1_000_000))) / 1_000_000n;
    const now = new Date("2026-11-11T09:30:00+08:00");
    const quote: FxQuote = {
      id: "fxq_sample", from, to, rate, provider: `${SAMPLE} · FX provider not yet connected`,
      quotedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 30_000).toISOString(),
      serviceFee: { amountMinor: fee.toString(), currency: from },
      recipientAmount: { amountMinor: recipient.toString(), currency: to },
    };
    return quote;
  },
  async getFxHistory(from, to) { return fxHistory(from, to); },
  async listBeneficiaries() { return beneficiaries; },
  async submitTransfer(req: TransferRequest): Promise<TransferReceipt> {
    // Sandbox: transfers are never completed. The real payment rail confirms later.
    return {
      reference: `TRF-SBX-${req.idempotencyKey.slice(0, 8).toUpperCase()}`,
      status: "pending",
      message: "Instruction recorded. Your balance changes only after our payment partner confirms the transfer. Live transfers are not yet enabled.",
    };
  },
  async listMarket() { return market; },
  async listHoldings() { return holdings; },
  async listOrders() { return orders; },
  async getPortfolioHistory() { return portfolioSeries; },
  async listNotifications() { return notifications; },
  async listDevices() { return devices; },
  async listCurrencyBalances(): Promise<CurrencyBalance[]> {
    // Sample: only HKD carries a balance. Other currencies are shown as not yet funded.
    return CURRENCIES.map((currency) => {
      const available = currency === "HKD" ? 108048036n : 0n;
      const pending = 0n;
      return {
        currency,
        available: { amountMinor: available.toString(), currency },
        pending: { amountMinor: pending.toString(), currency },
        total: { amountMinor: (available + pending).toString(), currency },
      };
    });
  },
  async getPriceHistory(symbol) {
    // Sample series only, not market data. Real charts need a licensed feed (decision D10).
    let seed = [...symbol].reduce((a, c) => a + c.charCodeAt(0), 0);
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    let v = 100;
    return Array.from({ length: 30 }, (_, i) => {
      v = v * (1 + (rnd() - 0.48) * 0.02);
      return { date: new Date(Date.UTC(2026, 9, 13 + i)).toISOString().slice(0, 10), value: Number(v.toFixed(2)) };
    });
  },
};
