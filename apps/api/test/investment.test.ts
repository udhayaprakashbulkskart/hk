import request from "supertest";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestApp, resetState, type TestApp } from "./helpers";
import { createFakeProviders } from "./provider-fake";
import { authed, balanceOf, fundHkd, registerCustomer, verifiedCustomer, type Ctx, type Customer } from "./support";

let t: TestApp;
let ctx: Ctx;
const http = () => request(t.app.getHttpServer());
const PRICE = 100_000n; // HKD 1,000 per unit, in minor units

beforeAll(async () => {
  const fake = createFakeProviders();
  t = await startTestApp({ transport: fake.transport });
  ctx = { t, fake };
});
afterAll(async () => { await t.close(); });
beforeEach(async () => { await resetState(t); });

function order(c: Customer, body: Record<string, unknown>) {
  return http().post("/v1/investments/orders").set(authed(c)).send({ currency: "HKD", idempotencyKey: `inv-${randomUUID()}`, ...body });
}

async function brokerIdFor(orderId: string): Promise<string> {
  const row = await t.container.db.investmentOrder.findUniqueOrThrow({ where: { id: orderId } });
  return row.brokerOrderId;
}

describe("investment orders", () => {
  it("refuses an order from a customer without verified KYC, before the broker is called", async () => {
    const c = await registerCustomer(t, "inv-unverified");
    await fundHkd(ctx, c, "2000000");
    const res = await order(c, { symbol: "ACME", side: "BUY", quantity: "1", limitPriceMinor: "100000" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("KYC_REQUIRED");
    expect(t.broker.orders.size).toBe(0);
  });

  it("walks an order through partial fill, fill and settlement, moving cash once and holding only what the broker confirmed", async () => {
    const c = await verifiedCustomer(t, "inv-buyer");
    await fundHkd(ctx, c, "2000000");
    const placed = await order(c, { symbol: "acme", side: "BUY", quantity: "10", limitPriceMinor: PRICE.toString() }).expect(201);
    expect(placed.body.status).toBe("PLACED");
    expect(placed.body.symbol).toBe("ACME");
    const broker = t.broker;
    const brokerId = await brokerIdFor(placed.body.id);

    // Nothing is held and no cash has moved until the broker confirms a fill.
    expect((await http().get("/v1/investments/holdings").set(authed(c))).body.items).toEqual([]);
    expect(await balanceOf(t, c.accountId, "HKD", "AVAILABLE")).toBe(2000000n);

    broker.executeFills(brokerId, [{ quantity: 4n, priceMinor: 98_000n }]);
    const partial = await http().post(`/v1/investments/orders/${placed.body.id}/sync`).set(authed(c)).expect(200);
    expect(partial.body.status).toBe("PARTIALLY_FILLED");
    expect(partial.body.settled).toBeNull();
    let holdings = await http().get("/v1/investments/holdings").set(authed(c)).expect(200);
    expect(holdings.body.items[0].quantity).toBe("4");
    expect(holdings.body.items[0].marketValue).toBeNull();
    expect(holdings.body.valuationNote).toContain("not available");

    broker.executeFills(brokerId, [{ quantity: 6n, priceMinor: 101_000n }]);
    const filled = await http().post(`/v1/investments/orders/${placed.body.id}/sync`).set(authed(c)).expect(200);
    expect(filled.body.status).toBe("SETTLED");
    const total = 4n * 98_000n + 6n * 101_000n;
    expect(filled.body.settled.amountMinor).toBe(total.toString());
    expect(await balanceOf(t, c.accountId, "HKD", "AVAILABLE")).toBe(2000000n - total);

    // Syncing again changes nothing: no second settlement, no second position.
    await http().post(`/v1/investments/orders/${placed.body.id}/sync`).set(authed(c)).expect(200);
    expect(await balanceOf(t, c.accountId, "HKD", "AVAILABLE")).toBe(2000000n - total);
    holdings = await http().get("/v1/investments/holdings").set(authed(c)).expect(200);
    expect(holdings.body.items[0].quantity).toBe("10");
    const settlements = await t.container.db.ledgerTransaction.count({ where: { kind: "TRADE_SETTLEMENT" } });
    expect(settlements).toBe(1);
  });

  it("sells held units, credits the customer, and realises P&L on the average cost", async () => {
    const c = await verifiedCustomer(t, "inv-seller");
    await fundHkd(ctx, c, "2000000");
    const buyOrder = await order(c, { symbol: "ACME", side: "BUY", quantity: "10", limitPriceMinor: PRICE.toString() }).expect(201);
    t.broker.executeFills(await brokerIdFor(buyOrder.body.id), [{ quantity: 10n, priceMinor: PRICE }]);
    await http().post(`/v1/investments/orders/${buyOrder.body.id}/sync`).set(authed(c)).expect(200);

    const tooMany = await order(c, { symbol: "ACME", side: "SELL", quantity: "11" });
    expect(tooMany.status).toBe(422);
    expect(tooMany.body.error.code).toBe("INSUFFICIENT_FUNDS");

    const sell = await order(c, { symbol: "ACME", side: "SELL", quantity: "4" }).expect(201);
    t.broker.executeFills(await brokerIdFor(sell.body.id), [{ quantity: 4n, priceMinor: 120_000n }]);
    const settled = await http().post(`/v1/investments/orders/${sell.body.id}/sync`).set(authed(c)).expect(200);
    expect(settled.body.status).toBe("SETTLED");
    const holdings = await http().get("/v1/investments/holdings").set(authed(c)).expect(200);
    expect(holdings.body.items[0].quantity).toBe("6");
    expect(holdings.body.items[0].realisedPnl.amountMinor).toBe((4n * (120_000n - PRICE)).toString());
    expect(await balanceOf(t, c.accountId, "HKD", "AVAILABLE")).toBe(2000000n - 10n * PRICE + 4n * 120_000n);
  });

  it("refuses a buy that the available cash cannot cover", async () => {
    const c = await verifiedCustomer(t, "inv-poor");
    await fundHkd(ctx, c, "500000");
    const res = await order(c, { symbol: "ACME", side: "BUY", quantity: "10", limitPriceMinor: PRICE.toString() });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("INSUFFICIENT_FUNDS");
  });

  it("does not show another customer's order to a customer who asks to sync it", async () => {
    const owner = await verifiedCustomer(t, "inv-owner");
    const other = await verifiedCustomer(t, "inv-other");
    await fundHkd(ctx, owner, "2000000");
    const placed = await order(owner, { symbol: "ACME", side: "BUY", quantity: "1", limitPriceMinor: PRICE.toString() }).expect(201);
    await http().post(`/v1/investments/orders/${placed.body.id}/sync`).set(authed(other)).expect(404);
  });
});
