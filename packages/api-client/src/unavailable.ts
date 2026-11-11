import type {
  Beneficiary, CurrencyBalance, DashboardSummary, DeviceSession, FinHubApi, FxQuote, Holding, MarketQuote,
  NotificationItem, Order, PortfolioPoint, Transaction, TransferReceipt, TransferRequest,
} from "@hkfinhub/types";

/**
 * Data client used until the customer screens read the live API. It invents nothing: balances are zero,
 * lists are empty and quotes are unavailable (null). Transfers cannot be submitted here.
 */
const zero = (currency: "HKD" = "HKD") => ({ amountMinor: "0", currency });

export const unavailableApi: FinHubApi = {
  async getDashboard(): Promise<DashboardSummary> {
    return {
      baseCurrency: "HKD",
      cashTotal: zero(),
      investmentValue: {
        marketValue: zero(), unrealisedPnl: zero(), unrealisedPnlPct: 0,
        asOf: new Date(0).toISOString(), source: "Not connected",
      },
      accounts: [],
      totals: { deposits: zero(), withdrawals: zero(), transfers: zero() },
      kyc: "not_started",
      dataSource: "unavailable",
    };
  },
  async listTransactions(): Promise<Transaction[]> { return []; },
  async getFxQuote(): Promise<FxQuote | null> { return null; },
  async getFxHistory(): Promise<PortfolioPoint[]> { return []; },
  async listBeneficiaries(): Promise<Beneficiary[]> { return []; },
  async submitTransfer(_req: TransferRequest): Promise<TransferReceipt> {
    return { reference: "", status: "failed", message: "Transfers are not available yet." };
  },
  async listMarket(): Promise<MarketQuote[]> { return []; },
  async listHoldings(): Promise<Holding[]> { return []; },
  async listOrders(): Promise<Order[]> { return []; },
  async getPortfolioHistory(): Promise<PortfolioPoint[]> { return []; },
  async listNotifications(): Promise<NotificationItem[]> { return []; },
  async listDevices(): Promise<DeviceSession[]> { return []; },
  async listCurrencyBalances(): Promise<CurrencyBalance[]> { return []; },
  async getPriceHistory(): Promise<PortfolioPoint[]> { return []; },
};
