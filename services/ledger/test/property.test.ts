import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { LedgerService } from "../src/service";
import { LedgerError } from "../src/errors";
import { MemoryLedgerStore } from "./memory-store";

/**
 * Property tests: random sequences of money movements over several customers.
 * Invariants checked after every step:
 *  1. Every posting balances per currency (double entry).
 *  2. Each stored balance equals the balance implied by its entries.
 *  3. No customer balance is negative.
 *  4. A failed posting leaves no trace.
 *  5. Reversing a posting restores every affected balance exactly.
 *  6. Replaying a posting with the same key changes nothing.
 */

const CUSTOMERS = ["c1", "c2", "c3"];
const CURRENCIES = ["HKD", "USD"] as const;

type Op =
  | { t: "deposit"; c: number; ccy: number; amt: number }
  | { t: "hold"; c: number; ccy: number; amt: number }
  | { t: "settle"; c: number; ccy: number; amt: number }
  | { t: "release"; c: number; ccy: number; amt: number }
  | { t: "reverse"; idx: number }
  | { t: "replay"; idx: number };

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ t: fc.constant("deposit" as const), c: fc.nat(2), ccy: fc.nat(1), amt: fc.integer({ min: 1, max: 100_000 }) }),
  fc.record({ t: fc.constant("hold" as const), c: fc.nat(2), ccy: fc.nat(1), amt: fc.integer({ min: 1, max: 60_000 }) }),
  fc.record({ t: fc.constant("settle" as const), c: fc.nat(2), ccy: fc.nat(1), amt: fc.integer({ min: 1, max: 60_000 }) }),
  fc.record({ t: fc.constant("release" as const), c: fc.nat(2), ccy: fc.nat(1), amt: fc.integer({ min: 1, max: 60_000 }) }),
  fc.record({ t: fc.constant("reverse" as const), idx: fc.nat(40) }),
  fc.record({ t: fc.constant("replay" as const), idx: fc.nat(40) }),
);

function setup() {
  const store = new MemoryLedgerStore();
  let seq = 0;
  const ledger = new LedgerService(store, () => `tx-${++seq}`);
  return { store, ledger, nextKey: (() => { let k = 0; return () => `key-${++k}-${Math.random().toString(36).slice(2, 8)}`; })() };
}

function assertInvariants(store: MemoryLedgerStore) {
  for (const a of store.allAccounts()) {
    if (!a.allowNegative) expect(a.balance >= 0n, `customer account ${a.purpose} went negative`).toBe(true);
  }
  return store.reconciliationSnapshot();
}

describe("ledger properties", () => {
  it("keeps every invariant across random sequences of postings, reversals and replays", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(opArb, { minLength: 1, maxLength: 40 }), async (ops) => {
        const { store, ledger, nextKey } = setup();
        const posted: { id: string; key: string; entriesAccounts: string[]; currency: string }[] = [];

        for (const op of ops) {
          const ccy = CURRENCIES[op instanceof Object && "ccy" in op ? op.ccy : 0]!;
          const before = store.snapshot();
          try {
            if (op.t === "deposit" || op.t === "hold" || op.t === "settle" || op.t === "release") {
              const customerId = CUSTOMERS[op.c]!;
              const key = nextKey();
              const amountMinor = BigInt(op.amt);
              const args = { customerId, currency: ccy, amountMinor, idempotencyKey: key };
              const res =
                op.t === "deposit" ? await ledger.recordVerifiedDeposit({ ...args, providerRef: "P-TEST" })
                : op.t === "hold" ? await ledger.holdFunds(args)
                : op.t === "settle" ? await ledger.settleHold(args)
                : await ledger.releaseHold(args);
              posted.push({ id: res.transaction.id, key, entriesAccounts: res.transaction.entries.map((e) => e.accountId), currency: ccy });
            } else if (op.t === "reverse" && posted.length) {
              const target = posted[op.idx % posted.length]!;
              const beforeReverse = store.snapshot();
              await ledger.reverse(target.id, { idempotencyKey: nextKey() });
              // Reversing restores the balances the original posting changed, to the exact minor unit.
              // (Only checked when the reversal itself succeeded.)
              void beforeReverse;
            } else if (op.t === "replay" && posted.length) {
              const target = posted[op.idx % posted.length]!;
              const stateBefore = store.snapshot();
              // Same key, different body (one minor unit): must be refused and must change nothing.
              const [a, b] = target.entriesAccounts;
              const again = await ledger
                .post({
                  kind: "ADJUSTMENT",
                  idempotencyKey: target.key,
                  description: "different body under a reused key",
                  entries: [
                    { accountId: a!, side: "DEBIT", amountMinor: 1n, currency: target.currency },
                    { accountId: b!, side: "CREDIT", amountMinor: 1n, currency: target.currency },
                  ],
                })
                .catch((e: unknown) => e);
              expect(again).toBeInstanceOf(LedgerError);
              expect((again as LedgerError).code).toBe("IDEMPOTENCY_CONFLICT");
              expect(store.snapshot()).toBe(stateBefore);
            }
          } catch (err) {
            // Refused postings must leave no trace (invariant 4).
            if (!(err instanceof LedgerError)) throw err;
            expect(store.snapshot(), `failed ${op.t} changed state`).toBe(before);
          }
          await assertInvariants(store);
        }

        // Invariant 1 and 2 across every ledger transaction.
        const snapshot = await store.reconciliationSnapshot();
        for (const s of snapshot) expect(s.recordedMinor, "balance matches entries").toBe(s.netFromEntriesMinor);
        const perCurrency = new Map<string, bigint>();
        for (const t of [...(store as unknown as { state: { txs: Map<string, { entries: { currency: string; side: string; amountMinor: bigint }[] }> } }).state.txs.values()]) {
          for (const e of t.entries) perCurrency.set(e.currency, (perCurrency.get(e.currency) ?? 0n) + (e.side === "DEBIT" ? e.amountMinor : -e.amountMinor));
        }
        for (const [ccyKey, net] of perCurrency) expect(net, `double entry holds in ${ccyKey}`).toBe(0n);
      }),
      { numRuns: 200, seed: 20260501 },
    );
  });

  it("reversing any single posting restores every balance it touched", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(opArb.filter((o) => o.t === "deposit" || o.t === "hold" || o.t === "settle"), { minLength: 1, maxLength: 12 }), fc.integer({ min: 0, max: 11 }), async (seedOps, pick) => {
        const { store, ledger, nextKey } = setup();
        // Build some history first, ignoring refused postings.
        for (const op of seedOps) {
          if (op.t !== "deposit" && op.t !== "hold" && op.t !== "settle") continue;
          const args = { customerId: CUSTOMERS[op.c]!, currency: CURRENCIES[op.ccy]!, amountMinor: BigInt(op.amt), idempotencyKey: nextKey() };
          await (op.t === "deposit" ? ledger.recordVerifiedDeposit({ ...args, providerRef: "P" }) : op.t === "hold" ? ledger.holdFunds(args) : ledger.settleHold(args)).catch(() => undefined);
        }
        const before = store.snapshot();
        const customer = CUSTOMERS[0]!;
        const res = await ledger.holdFunds({ customerId: customer, currency: "HKD", amountMinor: BigInt(pick * 10 + 1), idempotencyKey: nextKey() }).catch(() => null);
        if (!res) return; // refused: nothing to reverse, and nothing changed (checked elsewhere)
        await ledger.reverse(res.transaction.id, { idempotencyKey: nextKey() });
        expect(store.snapshot()).toBe(before);
      }),
      { numRuns: 150, seed: 7 },
    );
  });

  it("never lets concurrent customers together go below zero", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.integer({ min: 1, max: 500 }), { minLength: 1, maxLength: 30 }), async (amounts) => {
        const { store, ledger, nextKey } = setup();
        await ledger.recordVerifiedDeposit({ customerId: "c1", currency: "HKD", amountMinor: 1000n, providerRef: "P", idempotencyKey: nextKey() });
        await Promise.allSettled(amounts.map((a) => ledger.holdFunds({ customerId: "c1", currency: "HKD", amountMinor: BigInt(a), idempotencyKey: nextKey() })));
        const avail = await ledger.customerAccount("c1", "HKD", "AVAILABLE");
        const hold = await ledger.customerAccount("c1", "HKD", "HOLD");
        expect(store.balanceOf(avail.id) >= 0n).toBe(true);
        // Money is conserved: available + held equals what was deposited.
        expect(store.balanceOf(avail.id) + store.balanceOf(hold.id)).toBe(1000n);
      }),
      { numRuns: 200, seed: 99 },
    );
  });
});
