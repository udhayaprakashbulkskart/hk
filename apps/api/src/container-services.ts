import { AccountsService } from "@hkfinhub/accounts";
import { WalletService } from "@hkfinhub/wallet";
import { LedgerService } from "@hkfinhub/ledger";
import { PrismaAccountsStore, PrismaLedgerStore } from "@hkfinhub/database";
import type { Database } from "@hkfinhub/database";

/** Builds the Phase 5 services on top of one database. Kept separate so tests can reuse it. */
export function buildAccountingServices(db: Database, fieldKey: Uint8Array) {
  const ledger = new LedgerService(new PrismaLedgerStore(db));
  const accounts = new AccountsService(new PrismaAccountsStore(db), ledger, { fieldKey });
  const wallet = new WalletService(ledger);
  return { ledger, accounts, wallet };
}

