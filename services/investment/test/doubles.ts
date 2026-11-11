import type { BrokerAdapter, BrokerOrderSnapshot, Side } from "../src";

/**
 * TEST ONLY. Not a broker. State changes happen only when a test calls `executeFills`, so the order
 * lifecycle can be exercised. Nothing here reflects a real market price or a real execution.
 */
export function createTestBroker(): BrokerAdapter & {
  executeFills(brokerOrderId: string, fills: { quantity: bigint; priceMinor: bigint }[]): void;
  rejectOrder(brokerOrderId: string): void;
  orders: Map<string, { clientOrderId: string; side: Side; quantity: bigint; snapshot: BrokerOrderSnapshot }>;
} {
  const orders = new Map<string, { clientOrderId: string; side: Side; quantity: bigint; snapshot: BrokerOrderSnapshot }>();
  const byClient = new Map<string, string>();
  let seq = 0;
  return {
    id: "test-broker",
    orders,
    async placeOrder({ clientOrderId, side, quantity }) {
      const existing = byClient.get(clientOrderId);
      if (existing) return { brokerOrderId: existing };
      const id = `sbx-ord-${++seq}`;
      orders.set(id, { clientOrderId, side, quantity, snapshot: { status: "ACCEPTED", fills: [] } });
      byClient.set(clientOrderId, id);
      return { brokerOrderId: id };
    },
    async getOrder(brokerOrderId) {
      const o = orders.get(brokerOrderId);
      if (!o) throw new Error("unknown broker order");
      return o.snapshot;
    },
    executeFills(brokerOrderId, fills) {
      const o = orders.get(brokerOrderId);
      if (!o) throw new Error("unknown broker order");
      const fl = [...o.snapshot.fills];
      for (const f of fills) {
        fl.push({ brokerFillId: `${brokerOrderId}-f${fl.length + 1}`, quantity: f.quantity, priceMinor: f.priceMinor, executedAt: new Date() });
      }
      const filled = fl.reduce((s, f) => s + f.quantity, 0n);
      o.snapshot = { status: filled >= o.quantity ? "FILLED" : "PARTIALLY_FILLED", fills: fl };
    },
    rejectOrder(brokerOrderId) {
      const o = orders.get(brokerOrderId);
      if (o) o.snapshot = { status: "REJECTED", fills: [] };
    },
  };
}
