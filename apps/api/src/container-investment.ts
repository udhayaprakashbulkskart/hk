import { InvestmentService, type BrokerAdapter, type CashPort, type KycGate } from "@hkfinhub/investment";
import { PrismaInvestmentStore, type Database } from "@hkfinhub/database";
import type { LedgerService } from "@hkfinhub/ledger";
import type { AccountsService } from "@hkfinhub/accounts";
import type { KycService } from "@hkfinhub/kyc";
import type { ApiConfig } from "./config";

export interface InvestmentServices {
  investment: InvestmentService;
  /** The broker in use. Null in the runtime: no broker contract exists yet (D8 to D10). Tests inject one. */
  investmentBroker: BrokerAdapter | null;
}

/**
 * Production has no broker contract (decisions D8 to D10), so no broker is configured and every order is refused.
 * Tests inject a simulated broker; the runtime has none.
 */
export function buildInvestmentServices(args: {
  db: Database;
  config: ApiConfig;
  ledger: LedgerService;
  accounts: AccountsService;
  kyc: KycService;
  broker?: BrokerAdapter | undefined;
}): InvestmentServices {
  const broker: BrokerAdapter | null = args.broker ?? null;

  const cash: CashPort = {
    async availableMinor(userId, currency) {
      const row = (await args.accounts.ledgerRows(userId)).find((r) => r.currency === currency);
      if (!row) return 0n;
      return (await args.ledger.getBalances([row.availableLedgerId])).get(row.availableLedgerId) ?? 0n;
    },
    async settleTrade(i) {
      // The ledger keys customer accounts by the account id (as deposits do), not the user id.
      const customer = await args.ledger.customerAccount(i.accountId, i.currency, "AVAILABLE");
      const platform = await args.ledger.platformAccount(i.currency, "SETTLEMENT");
      // Buy: the customer pays the platform. Sell: the platform pays the customer.
      const customerSide = i.side === "BUY" ? "DEBIT" : "CREDIT";
      const platformSide = i.side === "BUY" ? "CREDIT" : "DEBIT";
      const result = await args.ledger.post({
        kind: "TRADE_SETTLEMENT",
        idempotencyKey: i.idempotencyKey,
        description: `${i.side === "BUY" ? "Investment purchase" : "Investment sale"} settlement`,
        reference: i.reference,
        createdBy: null,
        entries: [
          { accountId: customer.id, side: customerSide, amountMinor: i.amountMinor, currency: i.currency },
          { accountId: platform.id, side: platformSide, amountMinor: i.amountMinor, currency: i.currency },
        ],
      });
      return { transactionId: result.transaction.id };
    },
  };

  const kyc: KycGate = {
    async verified(userId) {
      return (await args.kyc.status(userId)).status === "VERIFIED";
    },
  };

  const investment = new InvestmentService({ store: new PrismaInvestmentStore(args.db), broker, cash, kyc });
  return { investment, investmentBroker: broker };
}
