import type { FillRecord, InvestmentStore, OrderRecord, OrderStatus, Side } from "@hkfinhub/investment";
import type { Database } from "./client";
import { Prisma } from "./generated/prisma/client";
import { acquireAccountLock } from "./locks";

type Tx = Omit<Database, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

function toOrder(r: {
  id: string; userId: string; accountId: string; symbol: string; side: string; quantity: bigint; limitPriceMinor: bigint | null; currency: string;
  status: string; brokerOrderId: string; brokerId: string; filledQuantity: bigint; settledMinor: bigint | null; settlementTxId: string | null; createdAt: Date; updatedAt: Date;
}): OrderRecord {
  return { ...r, side: r.side as Side, status: r.status as OrderStatus };
}

export class PrismaInvestmentStore implements InvestmentStore {
  constructor(private readonly db: Database | Tx) {}
  private get q(): Tx {
    return this.db as Tx;
  }

  async transaction<T>(fn: (tx: InvestmentStore) => Promise<T>): Promise<T> {
    return (this.db as Database).$transaction((tx) => fn(new PrismaInvestmentStore(tx as unknown as Tx)), { isolationLevel: "ReadCommitted", timeout: 20000 });
  }

  async lockAccount(accountId: string): Promise<void> {
    await acquireAccountLock(this.q, accountId);
  }

  async findOrderByKey(userId: string, key: string) {
    const r = await this.q.investmentOrder.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: key } } });
    return r ? toOrder(r) : null;
  }

  async insertOrder(o: Parameters<InvestmentStore["insertOrder"]>[0]) {
    const r = await this.q.investmentOrder.create({
      data: {
        id: o.id, userId: o.userId, accountId: o.accountId, symbol: o.symbol, side: o.side, quantity: o.quantity,
        limitPriceMinor: o.limitPriceMinor, currency: o.currency, status: "PLACED", brokerOrderId: o.brokerOrderId, brokerId: o.brokerId,
        idempotencyKey: o.idempotencyKey,
      },
    });
    return toOrder(r);
  }

  async findOrder(id: string) {
    const r = await this.q.investmentOrder.findUnique({ where: { id } });
    return r ? toOrder(r) : null;
  }

  async listOrders(userId: string, limit: number) {
    const rows = await this.q.investmentOrder.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
    return rows.map(toOrder);
  }

  /** The broker fill id is unique in the database. A repeat returns false instead of creating a second row. */
  async insertFill(f: Omit<FillRecord, "id">): Promise<boolean> {
    try {
      await this.q.investmentFill.create({
        data: { orderId: f.orderId, brokerFillId: f.brokerFillId, side: f.side, quantity: f.quantity, priceMinor: f.priceMinor, executedAt: f.executedAt },
      });
      return true;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return false;
      throw err;
    }
  }

  async listFills(orderId: string): Promise<FillRecord[]> {
    const rows = await this.q.investmentFill.findMany({ where: { orderId }, orderBy: { executedAt: "asc" } });
    return rows.map((r) => ({ ...r, side: r.side as Side }));
  }

  async listFillsForUser(userId: string, symbol?: string) {
    const rows = await this.q.investmentFill.findMany({
      where: { order: { userId, ...(symbol ? { symbol } : {}) } },
      include: { order: { select: { symbol: true } } },
      orderBy: { executedAt: "asc" },
    });
    return rows.map((r) => ({ id: r.id, orderId: r.orderId, brokerFillId: r.brokerFillId, side: r.side as Side, quantity: r.quantity, priceMinor: r.priceMinor, executedAt: r.executedAt, symbol: r.order.symbol }));
  }

  /** Compare-and-set: the status must still be one of `from`, and the filled quantity cannot go backwards. */
  async updateProgress(id: string, from: OrderStatus[], to: OrderStatus, filledQuantity: bigint, now: Date): Promise<boolean> {
    const res = await this.q.investmentOrder.updateMany({
      where: { id, status: { in: from }, filledQuantity: { lte: filledQuantity } },
      data: { status: to, filledQuantity, updatedAt: now },
    });
    return res.count === 1;
  }

  async markSettled(id: string, settledMinor: bigint, settlementTxId: string, now: Date): Promise<boolean> {
    const res = await this.q.investmentOrder.updateMany({
      where: { id, status: "FILLED", settlementTxId: null },
      data: { status: "SETTLED", settledMinor, settlementTxId, updatedAt: now },
    });
    return res.count === 1;
  }

  async reservedBuyMinor(accountId: string, currency: string): Promise<bigint> {
    const open = await this.q.investmentOrder.findMany({
      where: { accountId, currency, side: "BUY", status: { in: ["PLACED", "PARTIALLY_FILLED"] } },
      select: { quantity: true, filledQuantity: true, limitPriceMinor: true },
    });
    return open.reduce((s, o) => s + (o.quantity - o.filledQuantity) * (o.limitPriceMinor ?? 0n), 0n);
  }
}
