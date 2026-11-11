import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AdjustmentWorkflow, LedgerError } from "@hkfinhub/ledger";
import { PrismaLedgerStore } from "@hkfinhub/database";
import { startTestApp, resetState, type TestApp } from "./helpers";

/**
 * Ledger tests against real Postgres. These check the rules the database enforces itself,
 * so they hold even if application code is wrong.
 */

let t: TestApp;
beforeAll(async () => { t = await startTestApp(); });
afterAll(async () => { await t.close(); });
beforeEach(async () => { await resetState(t); });

const L = () => t.container.ledger;
const db = () => t.container.db;

/** A funded customer. Deposits go through the same posting path the payment webhook will use. */
async function funded(amount: bigint, currency = "HKD") {
  const customerId = randomUUID();
  const dep = await L().recordVerifiedDeposit({ customerId, currency, amountMinor: amount, providerRef: `P-${randomUUID()}`, idempotencyKey: `dep-${randomUUID()}` });
  const available = await L().customerAccount(customerId, currency, "AVAILABLE");
  const hold = await L().customerAccount(customerId, currency, "HOLD");
  return { customerId, available, hold, deposit: dep.transaction };
}

async function balance(id: string): Promise<bigint> {
  const row = await db().ledgerBalance.findUnique({ where: { ledgerAccountId: id } });
  return row?.balanceMinor ?? 0n;
}

describe("immutability", () => {
  it("rejects UPDATE and DELETE on posted entries and transactions", async () => {
    const f = await funded(1000n);
    await expect(db().$executeRawUnsafe(`UPDATE "LedgerEntry" SET "amountMinor" = 1`)).rejects.toThrow(/immutable/);
    await expect(db().$executeRawUnsafe(`DELETE FROM "LedgerEntry"`)).rejects.toThrow(/immutable/);
    await expect(db().$executeRawUnsafe(`UPDATE "LedgerTransaction" SET "description" = 'x'`)).rejects.toThrow(/immutable/);
    await expect(db().$executeRawUnsafe(`DELETE FROM "LedgerTransaction"`)).rejects.toThrow(/immutable/);
    expect(await balance(f.available.id)).toBe(1000n);
  });
});

describe("balances change only through posting", () => {
  it("rejects a direct balance update that bypasses the posting function", async () => {
    const f = await funded(1000n);
    await expect(db().$executeRawUnsafe(`UPDATE "LedgerBalance" SET "balanceMinor" = 999999999 WHERE "ledgerAccountId" = '${f.available.id}'`)).rejects.toThrow(/posting function/);
    await expect(db().$executeRawUnsafe(`INSERT INTO "LedgerBalance" ("ledgerAccountId","balanceMinor","updatedAt") VALUES ('${randomUUID()}', 5, now())`)).rejects.toThrow();
    expect(await balance(f.available.id)).toBe(1000n);
  });
});

describe("double entry", () => {
  it("refuses a transaction whose entries do not balance, at commit", async () => {
    const settlement = await L().platformAccount("HKD", "SETTLEMENT");
    const customer = await L().customerAccount(randomUUID(), "HKD", "AVAILABLE");
    await expect(
      db().$transaction(async (tx) => {
        const id = randomUUID();
        await tx.ledgerTransaction.create({ data: { id, kind: "ADJUSTMENT", idempotencyKey: `bad-${id}`, requestHash: "x", description: "unbalanced" } });
        await tx.$executeRaw`SELECT set_config('hkf.ledger_write', 'on', true)`;
        await tx.ledgerEntry.create({ data: { transactionId: id, ledgerAccountId: settlement.id, side: "DEBIT", amountMinor: 100n, currency: "HKD" } });
        await tx.ledgerEntry.create({ data: { transactionId: id, ledgerAccountId: customer.id, side: "CREDIT", amountMinor: 90n, currency: "HKD" } });
      }),
    ).rejects.toThrow(/unbalanced/);
  });

  it("refuses an entry posted in a currency different from its account", async () => {
    const f = await funded(1000n);
    const settlement = await L().platformAccount("USD", "SETTLEMENT");
    await expect(
      L().post({
        kind: "ADJUSTMENT",
        idempotencyKey: `mismatch-${randomUUID()}`,
        description: "wrong currency",
        entries: [
          { accountId: settlement.id, side: "DEBIT", amountMinor: 10n, currency: "HKD" },
          { accountId: f.available.id, side: "CREDIT", amountMinor: 10n, currency: "HKD" },
        ],
      }),
    ).rejects.toMatchObject({ code: "CURRENCY_MISMATCH" });
  });
});

describe("no overdraft", () => {
  it("refuses a hold larger than the available balance and changes nothing", async () => {
    const f = await funded(100n);
    const before = await db().ledgerTransaction.count();
    await expect(L().holdFunds({ customerId: f.customerId, currency: "HKD", amountMinor: 150n, idempotencyKey: `big-${randomUUID()}` })).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    expect(await balance(f.available.id)).toBe(100n);
    expect(await db().ledgerTransaction.count()).toBe(before);
  });

  it("never lets 100 concurrent holds overdraw: exactly the affordable ones succeed", async () => {
    const f = await funded(500n);
    const results = await Promise.allSettled(
      Array.from({ length: 100 }, () => L().holdFunds({ customerId: f.customerId, currency: "HKD", amountMinor: 10n, idempotencyKey: `race-${randomUUID()}` })),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const refused = results.filter((r) => r.status === "rejected" && (r.reason as LedgerError).code === "INSUFFICIENT_FUNDS").length;
    expect(ok).toBe(50);
    expect(refused).toBe(50);
    expect(await balance(f.available.id)).toBe(0n);
    expect(await balance(f.hold.id)).toBe(500n);
    const rec = await L().reconcile();
    expect(rec.mismatches).toHaveLength(0);
  });

  it("handles opposite-direction transfers in parallel without deadlock and conserves money", async () => {
    const a = await funded(10_000n);
    const b = await funded(10_000n);
    const pair = async (from: typeof a, to: typeof a, n: number) =>
      L().post({
        kind: "TRANSFER_HOLD",
        idempotencyKey: `xfer-${randomUUID()}`,
        description: `transfer ${n}`,
        entries: [
          { accountId: from.available.id, side: "DEBIT", amountMinor: 7n, currency: "HKD" },
          { accountId: to.available.id, side: "CREDIT", amountMinor: 7n, currency: "HKD" },
        ],
      });
    const jobs = Array.from({ length: 60 }, (_, i) => (i % 2 ? pair(a, b, i) : pair(b, a, i)));
    const results = await Promise.allSettled(jobs);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect((await balance(a.available.id)) + (await balance(b.available.id))).toBe(20_000n);
  });
});

describe("idempotency", () => {
  it("replays the same request without moving money twice", async () => {
    const f = await funded(1000n);
    const key = `hold-${randomUUID()}`;
    const first = await L().holdFunds({ customerId: f.customerId, currency: "HKD", amountMinor: 100n, idempotencyKey: key });
    const again = await L().holdFunds({ customerId: f.customerId, currency: "HKD", amountMinor: 100n, idempotencyKey: key });
    expect(again.replayed).toBe(true);
    expect(again.transaction.id).toBe(first.transaction.id);
    expect(await balance(f.available.id)).toBe(900n);
  });

  it("refuses a reused key with a different body", async () => {
    const f = await funded(1000n);
    const key = `reuse-${randomUUID()}`;
    await L().holdFunds({ customerId: f.customerId, currency: "HKD", amountMinor: 100n, idempotencyKey: key });
    await expect(L().holdFunds({ customerId: f.customerId, currency: "HKD", amountMinor: 200n, idempotencyKey: key })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
    expect(await balance(f.available.id)).toBe(900n);
  });

  it("settles to one transaction when many identical requests race", async () => {
    const f = await funded(1000n);
    const key = `race-same-${randomUUID()}`;
    const results = await Promise.all(
      Array.from({ length: 10 }, () => L().holdFunds({ customerId: f.customerId, currency: "HKD", amountMinor: 100n, idempotencyKey: key })),
    );
    expect(new Set(results.map((r) => r.transaction.id)).size).toBe(1);
    expect(await balance(f.available.id)).toBe(900n);
  });
});

describe("holds, settlement and release", () => {
  it("moves money from available to pending, then to settlement", async () => {
    const f = await funded(1000n);
    await L().holdFunds({ customerId: f.customerId, currency: "HKD", amountMinor: 300n, idempotencyKey: `h-${randomUUID()}` });
    expect([await balance(f.available.id), await balance(f.hold.id)]).toEqual([700n, 300n]);
    await L().settleHold({ customerId: f.customerId, currency: "HKD", amountMinor: 300n, idempotencyKey: `s-${randomUUID()}` });
    expect([await balance(f.available.id), await balance(f.hold.id)]).toEqual([700n, 0n]);
    const settlement = await L().platformAccount("HKD", "SETTLEMENT");
    expect(await balance(settlement.id)).toBe(1000n - 300n);
  });

  it("returns a released hold to the customer", async () => {
    const f = await funded(1000n);
    await L().holdFunds({ customerId: f.customerId, currency: "HKD", amountMinor: 300n, idempotencyKey: `h2-${randomUUID()}` });
    await L().releaseHold({ customerId: f.customerId, currency: "HKD", amountMinor: 300n, idempotencyKey: `r-${randomUUID()}` });
    expect([await balance(f.available.id), await balance(f.hold.id)]).toEqual([1000n, 0n]);
  });
});

describe("reversals", () => {
  it("restores balances exactly and refuses a second reversal", async () => {
    const f = await funded(1000n);
    const hold = await L().holdFunds({ customerId: f.customerId, currency: "HKD", amountMinor: 250n, idempotencyKey: `rv-${randomUUID()}` });
    await L().reverse(hold.transaction.id, { idempotencyKey: `rv1-${randomUUID()}` });
    expect([await balance(f.available.id), await balance(f.hold.id)]).toEqual([1000n, 0n]);
    await expect(L().reverse(hold.transaction.id, { idempotencyKey: `rv2-${randomUUID()}` })).rejects.toMatchObject({ code: "ALREADY_REVERSED" });
  });

  it("lets only one of many concurrent reversals of the same transaction through", async () => {
    const f = await funded(1000n);
    const hold = await L().holdFunds({ customerId: f.customerId, currency: "HKD", amountMinor: 250n, idempotencyKey: `crv-${randomUUID()}` });
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => L().reverse(hold.transaction.id, { idempotencyKey: `crv-${randomUUID()}` })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await balance(f.available.id)).toBe(1000n);
  });

  it("refuses to reverse a reversal", async () => {
    const f = await funded(1000n);
    const hold = await L().holdFunds({ customerId: f.customerId, currency: "HKD", amountMinor: 50n, idempotencyKey: `rr-${randomUUID()}` });
    const rev = await L().reverse(hold.transaction.id, { idempotencyKey: `rr1-${randomUUID()}` });
    await expect(L().reverse(rev.transaction.id, { idempotencyKey: `rr2-${randomUUID()}` })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });
});

describe("reconciliation", () => {
  it("reports no mismatches when every balance matches its entries", async () => {
    const f = await funded(1000n);
    await L().holdFunds({ customerId: f.customerId, currency: "HKD", amountMinor: 100n, idempotencyKey: `rc-${randomUUID()}` });
    const result = await L().reconcile();
    expect(result.checked).toBeGreaterThan(0);
    expect(result.mismatches).toHaveLength(0);
    expect(await db().reconciliationRecord.count()).toBe(0);
  });

  it("detects a balance altered outside the posting path and opens a record", async () => {
    const f = await funded(1000n);
    // Simulates a faulty migration or a database administrator with the guard disabled.
    await db().$executeRawUnsafe(`ALTER TABLE "LedgerBalance" DISABLE TRIGGER ledger_balance_guard`);
    try {
      await db().$executeRawUnsafe(`UPDATE "LedgerBalance" SET "balanceMinor" = 5000 WHERE "ledgerAccountId" = '${f.available.id}'`);
    } finally {
      await db().$executeRawUnsafe(`ALTER TABLE "LedgerBalance" ENABLE TRIGGER ledger_balance_guard`);
    }
    const result = await L().reconcile();
    expect(result.mismatches.map((m) => m.accountId)).toContain(f.available.id);
    const records = await db().reconciliationRecord.findMany({ where: { ledgerAccountId: f.available.id } });
    expect(records).toHaveLength(1);
    expect(records[0]!.status).toBe("OPEN");
    expect(records[0]!.expectedMinor).toBe(1000n);
    expect(records[0]!.recordedMinor).toBe(5000n);
  });
});

describe("maker-checker adjustments", () => {
  it("a request changes no balance until a different person approves it", async () => {
    const f = await funded(1000n);
    const reserve = await L().platformAccount("HKD", "SUSPENSE");
    const wf = new AdjustmentWorkflow(new PrismaLedgerStore(db()), L(), randomUUID);
    const id = await wf.request("maker-1", { customerAccountId: f.available.id, currency: "HKD", amountMinor: "250", direction: "CREDIT", counterAccountId: reserve.id, reason: "Goodwill credit after outage" });
    expect(await balance(f.available.id)).toBe(1000n);
    await expect(wf.approve("maker-1", id)).rejects.toMatchObject({ code: "SELF_APPROVAL" });
    expect(await balance(f.available.id)).toBe(1000n);
    const done = await wf.approve("checker-9", id);
    expect(done.transactionId).toBeTruthy();
    expect(await balance(f.available.id)).toBe(1250n);
    await expect(wf.approve("checker-9", id)).rejects.toMatchObject({ code: "APPROVAL_NOT_PENDING" });
  });

  it("refuses an adjustment without a real reason", async () => {
    const f = await funded(1000n);
    const reserve = await L().platformAccount("HKD", "SUSPENSE");
    const wf = new AdjustmentWorkflow(new PrismaLedgerStore(db()), L(), randomUUID);
    await expect(wf.request("maker-1", { customerAccountId: f.available.id, currency: "HKD", amountMinor: "10", direction: "CREDIT", counterAccountId: reserve.id, reason: "ok" })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });
});

describe("activity and totals", () => {
  it("shows deposits in totals and in recent activity", async () => {
    const f = await funded(4200n);
    const totals = await t.container.wallet.totals([f.available.id, f.hold.id], "HKD");
    expect(totals.depositsMinor).toBe(4200n);
    const activity = await t.container.wallet.activity([f.available.id], 10);
    expect(activity[0]).toMatchObject({ kind: "deposit", signedAmountMinor: "4200", currency: "HKD", status: "posted" });
  });
});
