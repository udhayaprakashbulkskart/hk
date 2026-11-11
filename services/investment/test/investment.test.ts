import { describe, expect, it } from "vitest";
import { InvestmentError, InvestmentService, positionFromFills, type CashPort } from "../src";
import { createSandboxBroker } from "./doubles";
import { createMemoryInvestmentStore } from "./memory-store";

const t0 = new Date("2026-11-11T10:00:00Z");
const at = (m: number) => new Date(t0.getTime() + m * 60_000);

function harness(opts: { verified?: boolean; cash?: bigint; broker?: boolean } = {}) {
  const store = createMemoryInvestmentStore();
  const broker = createSandboxBroker();
  const settled: { userId: string; side: string; amountMinor: bigint; idempotencyKey: string }[] = [];
  let cash = opts.cash ?? 1_000_000n;
  const cashPort: CashPort = {
    async availableMinor() { return cash; },
    async settleTrade(i) {
      settled.push({ userId: i.userId, side: i.side, amountMinor: i.amountMinor, idempotencyKey: i.idempotencyKey });
      cash = i.side === "BUY" ? cash - i.amountMinor : cash + i.amountMinor;
      return { transactionId: `tx-${settled.length}` };
    },
  };
  const svc = new InvestmentService({
    store,
    broker: opts.broker === false ? null : broker,
    cash: cashPort,
    kyc: { verified: async () => opts.verified ?? true },
    now: () => t0,
  });
  return { svc, store, broker, settled };
}

const buy = (qty: bigint, price: bigint, key = `k-${qty}-${price}-${Math.random()}`) => ({
  userId: "u1", accountId: "a1", symbol: "ACME", side: "BUY" as const, quantity: qty, limitPriceMinor: price, currency: "HKD", idempotencyKey: key,
});

describe("position from fills", () => {
  it("computes average cost and realised P&L from fills only", () => {
    const pos = positionFromFills([
      { id: "1", side: "BUY", quantity: 10n, priceMinor: 100n, executedAt: at(1) },
      { id: "2", side: "BUY", quantity: 10n, priceMinor: 200n, executedAt: at(2) },
      { id: "3", side: "SELL", quantity: 5n, priceMinor: 250n, executedAt: at(3) },
    ]);
    expect(pos.quantity).toBe(15n);
    expect(pos.averageCostMinor).toBe(150n);
    expect(pos.realisedPnlMinor).toBe(500n);
    expect(pos.costBasisMinor).toBe(2250n);
  });
  it("refuses to sell more than is held", () => {
    expect(() => positionFromFills([{ id: "1", side: "SELL", quantity: 1n, priceMinor: 1n, executedAt: at(1) }])).toThrow();
  });
});

describe("order lifecycle", () => {
  it("moves placed, partially filled, filled and settled, and holdings follow the broker's fills", async () => {
    const { svc, broker, settled } = harness();
    const order = await svc.placeOrder(buy(10n, 100n));
    expect(order.status).toBe("PLACED");
    expect(await svc.holdings("u1")).toEqual([]);

    broker.executeFills(order.brokerOrderId, [{ quantity: 4n, priceMinor: 98n }]);
    const partial = await svc.sync(order.id);
    expect(partial.status).toBe("PARTIALLY_FILLED");
    expect((await svc.holdings("u1"))[0]!.position.quantity).toBe(4n);
    expect(settled).toHaveLength(0);

    broker.executeFills(order.brokerOrderId, [{ quantity: 6n, priceMinor: 101n }]);
    const filled = await svc.sync(order.id);
    expect(filled.status).toBe("SETTLED");
    expect(filled.settledMinor).toBe(4n * 98n + 6n * 101n);
    expect(settled).toEqual([{ userId: "u1", side: "BUY", amountMinor: 4n * 98n + 6n * 101n, idempotencyKey: `trade-settle-${order.id}` }]);
    expect((await svc.holdings("u1"))[0]!.position.quantity).toBe(10n);
  });

  it("does not double-count fills or cash when synced repeatedly", async () => {
    const { svc, broker, settled } = harness();
    const order = await svc.placeOrder(buy(5n, 100n));
    broker.executeFills(order.brokerOrderId, [{ quantity: 5n, priceMinor: 100n }]);
    await svc.sync(order.id);
    await svc.sync(order.id);
    await svc.sync(order.id);
    expect(settled).toHaveLength(1);
    expect((await svc.holdings("u1"))[0]!.position.quantity).toBe(5n);
  });

  it("returns the same order for a repeated idempotency key, and places one broker order", async () => {
    const { svc, broker } = harness();
    const input = buy(2n, 50n, "same-key");
    const a = await svc.placeOrder(input);
    const b = await svc.placeOrder(input);
    expect(b.id).toBe(a.id);
    expect(broker.orders.size).toBe(1);
  });

  it("a rejected order never settles and holds nothing", async () => {
    const { svc, broker, settled } = harness();
    const order = await svc.placeOrder(buy(3n, 100n));
    broker.rejectOrder(order.brokerOrderId);
    const rejected = await svc.sync(order.id);
    expect(rejected.status).toBe("REJECTED");
    expect(settled).toHaveLength(0);
    expect(await svc.holdings("u1")).toEqual([]);
  });
});

describe("risk checks", () => {
  it("refuses any order from a customer without verified KYC, before the broker is called", async () => {
    const { svc, broker } = harness({ verified: false });
    await expect(svc.placeOrder(buy(1n, 100n))).rejects.toMatchObject({ code: "KYC_REQUIRED" });
    expect(broker.orders.size).toBe(0);
  });

  it("refuses a buy the available cash cannot cover, counting cash held by open buys", async () => {
    const { svc } = harness({ cash: 2000n });
    await svc.placeOrder(buy(5n, 200n));
    await expect(svc.placeOrder(buy(6n, 200n))).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    await expect(svc.placeOrder(buy(5n, 200n))).resolves.toBeDefined();
  });

  it("refuses a buy without a limit price", async () => {
    const { svc } = harness();
    await expect(svc.placeOrder({ ...buy(1n, 1n), limitPriceMinor: null })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("refuses a sell of shares not held", async () => {
    const { svc } = harness();
    await expect(svc.placeOrder({ ...buy(1n, 100n), side: "SELL", limitPriceMinor: null })).rejects.toBeInstanceOf(InvestmentError);
  });

  it("refuses everything when no broker is configured", async () => {
    const { svc } = harness({ broker: false });
    await expect(svc.placeOrder(buy(1n, 100n))).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
  });
});
