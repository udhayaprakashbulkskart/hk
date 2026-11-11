import type { LedgerService, TxKind } from "@hkfinhub/ledger";
import { LAUNCH_CURRENCIES, type LaunchCurrency } from "@hkfinhub/shared";

/** Customer-facing view of a ledger entry. Signs follow the customer's point of view. */
export interface ActivityItem {
  id: string;
  kind: "received" | "sent" | "deposit" | "withdrawal" | "trade" | "fx" | "fee";
  title: string;
  currency: string;
  signedAmountMinor: string;
  status: "posted" | "pending";
  occurredAt: string;
  reference: string;
}

/** Ledger-derived projections: balances, totals and activity. Owns no state of its own. */
export class WalletService {
  constructor(private readonly ledger: LedgerService) {}

  /** Available, pending and total per currency. `pending` is funds held for transfers not yet confirmed. */
  async balances(currencyAccounts: { currency: string; availableLedgerId: string; holdLedgerId: string }[]) {
    const ids = currencyAccounts.flatMap((c) => [c.availableLedgerId, c.holdLedgerId]);
    const map = await this.ledger.getBalances(ids);
    return currencyAccounts.map((c) => {
      const available = map.get(c.availableLedgerId) ?? 0n;
      const pending = map.get(c.holdLedgerId) ?? 0n;
      return { currency: c.currency as LaunchCurrency, availableMinor: available, pendingMinor: pending, totalMinor: available + pending };
    });
  }

  /** Totals since the beginning of the ledger: money in by deposit, out by withdrawal, sent by settled transfer. */
  async totals(accountIds: string[], currency: LaunchCurrency) {
    const rows = await this.ledger.totalsByKind(accountIds);
    const pick = (kind: TxKind, side: "DEBIT" | "CREDIT") =>
      rows.filter((r) => r.kind === kind && r.side === side && r.currency === currency).reduce((acc, r) => acc + r.amountMinor, 0n);
    return {
      currency,
      depositsMinor: pick("DEPOSIT", "CREDIT"),
      withdrawalsMinor: pick("WITHDRAWAL", "DEBIT"),
      transfersMinor: pick("TRANSFER_SETTLE", "DEBIT"),
    };
  }

  /**
   * Recent activity on the customer's spendable (AVAILABLE) accounts. Each transaction appears once,
   * on the side the customer sees. Internal moves to HOLD are not listed. Phase 6 adds a transfer
   * state machine, so a transfer's pending status will follow its later confirmation or failure.
   */
  async activity(availableLedgerIds: string[], limit = 20): Promise<ActivityItem[]> {
    const entries = await this.ledger.listEntries(availableLedgerIds, limit);
    return entries.map((e) => {
      const ownCredit = e.side === "CREDIT";
      const kind = mapKind(e.kind, ownCredit);
      return {
        id: `${e.transactionId}:${e.currency}:${e.side}`,
        kind,
        title: e.description,
        currency: e.currency,
        signedAmountMinor: (ownCredit ? e.amountMinor : -e.amountMinor).toString(),
        status: e.kind === "TRANSFER_HOLD" ? "pending" : "posted",
        occurredAt: e.postedAt.toISOString(),
        reference: e.reference ?? e.transactionId,
      };
    });
  }
}

function mapKind(kind: TxKind, credit: boolean): ActivityItem["kind"] {
  switch (kind) {
    case "DEPOSIT": return "deposit";
    case "WITHDRAWAL": return "withdrawal";
    case "TRANSFER_SETTLE": return "sent";
    case "TRANSFER_HOLD":
    case "TRANSFER_RELEASE": return credit ? "received" : "sent";
    case "FX_CONVERSION": return "fx";
    case "FEE": return "fee";
    case "TRADE_SETTLEMENT": return "trade";
    default: return credit ? "received" : "sent";
  }
}

export { LAUNCH_CURRENCIES };
