import { positionFromFills, type Position } from "./position";
import { InvestmentError } from "./errors";
import type { BrokerAdapter, CashPort, FillRecord, InvestmentStore, KycGate, OrderRecord, Side } from "./ports";

export interface InvestmentDeps {
  store: InvestmentStore;
  broker: BrokerAdapter | null;
  cash: CashPort;
  kyc: KycGate;
  now?: () => Date;
}

const SYMBOL = /^[A-Z0-9.]{1,12}$/;

/**
 * Investment orders. Rules:
 *  - KYC must be verified before any order (the risk check comes first).
 *  - A buy must be covered by available cash minus cash already held by open buys.
 *  - Holdings come only from broker-reported fills. A fill is recorded once, by broker fill id.
 *  - Cash moves on the ledger only once an order is fully filled, and only once per order.
 *  - With no broker configured, every order is refused as not yet available.
 */
export class InvestmentService {
  private readonly now: () => Date;
  constructor(private readonly d: InvestmentDeps) {
    this.now = d.now ?? (() => new Date());
  }

  async placeOrder(input: {
    userId: string;
    accountId: string;
    symbol: string;
    side: Side;
    quantity: bigint;
    limitPriceMinor: bigint | null;
    currency: string;
    idempotencyKey: string;
  }): Promise<OrderRecord> {
    const existing = await this.d.store.findOrderByKey(input.userId, input.idempotencyKey);
    if (existing) return existing;
    if (!(await this.d.kyc.verified(input.userId))) throw new InvestmentError("KYC_REQUIRED", "verify your identity before investing");
    if (!SYMBOL.test(input.symbol)) throw new InvestmentError("INVALID_REQUEST", "unknown symbol");
    if (input.quantity <= 0n) throw new InvestmentError("INVALID_REQUEST", "quantity must be a whole number of at least 1");
    if (input.side !== "BUY" && input.side !== "SELL") throw new InvestmentError("INVALID_REQUEST", "side must be BUY or SELL");
    const broker = this.d.broker;
    if (!broker) throw new InvestmentError("NOT_AVAILABLE", "investing is not yet available");

    return this.d.store.transaction(async (tx) => {
      await tx.lockAccount(input.accountId);
      if (input.side === "SELL") {
        const held = positionFromFills((await tx.listFillsForUser(input.userId, input.symbol)).map(toFill)).quantity;
        const openSells = await this.openSellQuantity(tx, input.userId, input.symbol);
        if (input.quantity > held - openSells) throw new InvestmentError("INSUFFICIENT_FUNDS", "you do not hold enough of this investment to sell");
      } else {
        if (input.limitPriceMinor === null || input.limitPriceMinor <= 0n) throw new InvestmentError("INVALID_REQUEST", "a buy needs a limit price");
        const cost = input.quantity * input.limitPriceMinor;
        const available = await this.d.cash.availableMinor(input.userId, input.currency);
        const reserved = await tx.reservedBuyMinor(input.accountId, input.currency);
        if (cost > available - reserved) throw new InvestmentError("INSUFFICIENT_FUNDS", "not enough available cash for this order");
      }
      const clientId = `ord-${input.idempotencyKey}`;
      const placed = await broker.placeOrder({ clientOrderId: clientId, symbol: input.symbol, side: input.side, quantity: input.quantity });
      return tx.insertOrder({
        id: crypto.randomUUID(),
        userId: input.userId,
        accountId: input.accountId,
        symbol: input.symbol,
        side: input.side,
        quantity: input.quantity,
        limitPriceMinor: input.side === "BUY" ? input.limitPriceMinor : null,
        currency: input.currency,
        brokerOrderId: placed.brokerOrderId,
        brokerId: broker.id,
        idempotencyKey: input.idempotencyKey,
      });
    });
  }

  /** Brings an order up to date from the broker. Safe to call repeatedly. */
  async sync(orderId: string): Promise<OrderRecord> {
    const order = await this.d.store.findOrder(orderId);
    if (!order) throw new InvestmentError("NOT_FOUND", "order not found");
    if (!this.d.broker) throw new InvestmentError("NOT_AVAILABLE", "investing is not yet available");
    const snap = await this.d.broker.getOrder(order.brokerOrderId);
    if (snap.status === "REJECTED") {
      await this.d.store.updateProgress(order.id, ["PLACED", "PARTIALLY_FILLED"], "REJECTED", order.filledQuantity, this.now());
      return (await this.d.store.findOrder(order.id))!;
    }
    for (const f of snap.fills) {
      await this.d.store.insertFill({ orderId: order.id, brokerFillId: f.brokerFillId, side: order.side, quantity: f.quantity, priceMinor: f.priceMinor, executedAt: f.executedAt });
    }
    const filled = (await this.d.store.listFills(order.id)).reduce((s, f) => s + f.quantity, 0n);
    if (filled > order.filledQuantity) {
      const to = filled >= order.quantity ? "FILLED" : "PARTIALLY_FILLED";
      await this.d.store.updateProgress(order.id, ["PLACED", "PARTIALLY_FILLED"], to, filled, this.now());
    }
    const current = (await this.d.store.findOrder(order.id))!;
    if (current.status === "FILLED" && current.settlementTxId === null) {
      await this.settle(current);
    }
    return (await this.d.store.findOrder(order.id))!;
  }

  /** Cash for a fully filled order is posted once. The amount is the sum of the broker's fills. */
  private async settle(order: OrderRecord): Promise<void> {
    const fills = await this.d.store.listFills(order.id);
    const amount = fills.reduce((s, f) => s + f.quantity * f.priceMinor, 0n);
    const { transactionId } = await this.d.cash.settleTrade({
      userId: order.userId,
      accountId: order.accountId,
      currency: order.currency,
      side: order.side,
      amountMinor: amount,
      idempotencyKey: `trade-settle-${order.id}`,
      reference: order.id,
    });
    await this.d.store.markSettled(order.id, amount, transactionId, this.now());
  }

  async holdings(userId: string): Promise<{ symbol: string; position: Position }[]> {
    const rows = await this.d.store.listFillsForUser(userId);
    const bySymbol = new Map<string, FillRecord[]>();
    for (const r of rows) {
      const list = bySymbol.get(r.symbol) ?? [];
      list.push(r);
      bySymbol.set(r.symbol, list);
    }
    const out: { symbol: string; position: Position }[] = [];
    for (const [symbol, list] of bySymbol) {
      const position = positionFromFills(list.map(toFill));
      if (position.quantity > 0n || position.realisedPnlMinor !== 0n) out.push({ symbol, position });
    }
    return out.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  orders(userId: string, limit = 50): Promise<OrderRecord[]> {
    return this.d.store.listOrders(userId, limit);
  }

  private async openSellQuantity(tx: InvestmentStore, userId: string, symbol: string): Promise<bigint> {
    const open = (await tx.listOrders(userId, 500)).filter((o) => o.symbol === symbol && o.side === "SELL" && (o.status === "PLACED" || o.status === "PARTIALLY_FILLED"));
    return open.reduce((s, o) => s + (o.quantity - o.filledQuantity), 0n);
  }
}

function toFill(f: { id: string; side: Side; quantity: bigint; priceMinor: bigint; executedAt: Date }) {
  return { id: f.id, side: f.side, quantity: f.quantity, priceMinor: f.priceMinor, executedAt: f.executedAt };
}
