import type { FxQuoteRecord, FxStore } from "@hkfinhub/fx";
import type { Database } from "./client";
import { Prisma } from "./generated/prisma/client";
import { acquireAccountLock } from "./locks";

type Tx = Omit<Database, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

function toQuote(r: { id: string; accountId: string; fromCurrency: string; toCurrency: string; amountMinor: bigint; feeMinor: bigint; recipientMinor: bigint; rateScaled: bigint; provider: string; quotedAt: Date; expiresAt: Date; executedAt: Date | null; ledgerTransactionId: string | null }): FxQuoteRecord {
  return r;
}

export class PrismaFxStore implements FxStore {
  constructor(private readonly db: Database | Tx) {}
  private get q(): Tx {
    return this.db as Tx;
  }

  async insertQuote(q: Omit<FxQuoteRecord, "executedAt" | "ledgerTransactionId">): Promise<void> {
    await this.q.fxQuote.create({ data: { ...q, id: q.id, rateScaled: q.rateScaled } });
  }

  async findQuote(id: string): Promise<FxQuoteRecord | null> {
    const r = await this.q.fxQuote.findUnique({ where: { id } });
    return r ? toQuote(r) : null;
  }

  async claimQuote(id: string, now: Date, ledgerTransactionId: string | null): Promise<boolean> {
    const r = await this.q.fxQuote.updateMany({
      where: { id, executedAt: null, expiresAt: { gt: now } },
      data: { executedAt: now, ledgerTransactionId },
    });
    return r.count === 1;
  }

  async withAccountLock<T>(accountId: string, fn: () => Promise<T>): Promise<T> {
    return (this.db as Database).$transaction(async (tx) => {
      await acquireAccountLock(tx as unknown as Tx, accountId);
      return fn();
    }, { isolationLevel: "ReadCommitted", timeout: 20000 });
  }
}

export { Prisma };
