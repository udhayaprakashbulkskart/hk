import type { FillRecord, InvestmentStore, OrderRecord, OrderStatus } from "../src";

export function createMemoryInvestmentStore(): InvestmentStore & { orders: Map<string, OrderRecord> } {
  const orders = new Map<string, OrderRecord>();
  const fills: FillRecord[] = [];
  const owner = new Map<string, string>();
  const store: InvestmentStore & { orders: Map<string, OrderRecord> } = {
    orders,
    async transaction(fn) {
      return fn(store);
    },
    async lockAccount() {},
    async findOrderByKey(userId, key) {
      const o = [...orders.values()].find((x) => owner.get(x.id) === `${userId}:${key}`);
      return o ? { ...o } : null;
    },
    async insertOrder(o) {
      const row: OrderRecord = {
        id: o.id, userId: o.userId, accountId: o.accountId, symbol: o.symbol, side: o.side, quantity: o.quantity,
        limitPriceMinor: o.limitPriceMinor, currency: o.currency, status: "PLACED", brokerOrderId: o.brokerOrderId, brokerId: o.brokerId,
        filledQuantity: 0n, settledMinor: null, settlementTxId: null, createdAt: new Date(), updatedAt: new Date(),
      };
      orders.set(row.id, row);
      owner.set(row.id, `${o.userId}:${o.idempotencyKey}`);
      return { ...row };
    },
    async findOrder(id) {
      const o = orders.get(id);
      return o ? { ...o } : null;
    },
    async listOrders(userId, limit) {
      return [...orders.values()].filter((o) => o.userId === userId).slice(0, limit).map((o) => ({ ...o }));
    },
    async insertFill(f) {
      if (fills.some((x) => x.brokerFillId === f.brokerFillId)) return false;
      fills.push({ ...f, id: `fill-${fills.length + 1}` });
      return true;
    },
    async listFills(orderId) {
      return fills.filter((f) => f.orderId === orderId).map((f) => ({ ...f }));
    },
    async listFillsForUser(userId, symbol) {
      return fills
        .filter((f) => {
          const o = orders.get(f.orderId);
          return o && o.userId === userId && (!symbol || o.symbol === symbol);
        })
        .map((f) => ({ ...f, symbol: orders.get(f.orderId)!.symbol }));
    },
    async updateProgress(id, from, to, filledQuantity) {
      const o = orders.get(id);
      if (!o || !from.includes(o.status as OrderStatus) || filledQuantity < o.filledQuantity) return false;
      orders.set(id, { ...o, status: to, filledQuantity, updatedAt: new Date() });
      return true;
    },
    async markSettled(id, settledMinor, settlementTxId) {
      const o = orders.get(id);
      if (!o || o.settlementTxId !== null || o.status !== "FILLED") return false;
      orders.set(id, { ...o, status: "SETTLED", settledMinor, settlementTxId });
      return true;
    },
    async reservedBuyMinor(accountId, currency) {
      return [...orders.values()]
        .filter((o) => o.accountId === accountId && o.currency === currency && o.side === "BUY" && (o.status === "PLACED" || o.status === "PARTIALLY_FILLED"))
        .reduce((s, o) => s + (o.quantity - o.filledQuantity) * (o.limitPriceMinor ?? 0n), 0n);
    },
  };
  return store;
}
