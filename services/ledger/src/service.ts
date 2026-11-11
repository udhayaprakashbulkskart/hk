import { createHash, randomUUID } from "node:crypto";
import { CURRENCY_META, isLaunchCurrency } from "@hkfinhub/shared";
import { DuplicateKeyError, InsufficientFundsError, LedgerError } from "./errors";
import type { AccountSpec, EntryInput, LedgerAccountRecord, LedgerStore, Side, TxKind, TxWithEntries } from "./ports";

export interface PostRequest {
  kind: TxKind;
  idempotencyKey: string;
  description: string;
  reference?: string | null;
  entries: EntryInput[];
  reversesId?: string | null;
  createdBy?: string | null;
}

export interface PostResult {
  transaction: TxWithEntries;
  /** True when this call found an earlier identical request and returned its result. */
  replayed: boolean;
}

/**
 * The double-entry posting service. Every money movement in the platform goes through `post`.
 *
 * Guarantees, most of them also enforced by the database (see the phase 5 migration):
 *  - Idempotent: the same key and body return the original transaction; the same key with a different
 *    body is refused.
 *  - Balanced: entries must net to zero per currency, or the posting is refused before any write.
 *  - Ordered locking: balances are updated in account-id order, so concurrent postings cannot deadlock.
 *  - No overdraft: the database refuses any customer balance below zero, even under concurrency.
 *  - Immutable: entries and transactions cannot be updated or deleted; a correction is a reversal.
 */
export class LedgerService {
  constructor(private readonly store: LedgerStore, private readonly newId: () => string = randomUUID) {}

  async post(req: PostRequest): Promise<PostResult> {
    validateRequest(req);
    const requestHash = hashRequest(req);

    const existing = await this.store.findTransactionByKey(req.idempotencyKey);
    if (existing) return replayOrConflict(existing, requestHash);

    try {
      const transaction = await this.store.transaction(async (tx) => {
        await tx.enableBalanceWrites();
        const accounts = await tx.getAccounts([...new Set(req.entries.map((e) => e.accountId))]);
        checkAccounts(req.entries, accounts);
        checkBalancedPerCurrency(req.entries);

        const id = this.newId();
        await tx.insertTransaction({
          id,
          kind: req.kind,
          idempotencyKey: req.idempotencyKey,
          requestHash,
          description: req.description,
          reference: req.reference ?? null,
          reversesId: req.reversesId ?? null,
          createdBy: req.createdBy ?? null,
        });
        await tx.insertEntries(id, req.entries);

        // One signed delta per account, applied in ascending account id order.
        const deltas = netDeltas(req.entries, accounts);
        await tx.applyBalanceDeltas(deltas);
        return id;
      });
      const posted = await this.store.findTransaction(transaction);
      if (!posted) throw new LedgerError("TRANSACTION_NOT_FOUND", "posted transaction vanished");
      return { transaction: posted, replayed: false };
    } catch (err) {
      if (err instanceof DuplicateKeyError) {
        if (err.target === "reversesId") throw new LedgerError("ALREADY_REVERSED", "this transaction has already been reversed");
        const again = await this.store.findTransactionByKey(req.idempotencyKey);
        if (again) return replayOrConflict(again, requestHash);
      }
      if (err instanceof InsufficientFundsError) throw new LedgerError("INSUFFICIENT_FUNDS", "insufficient funds");
      throw err;
    }
  }

  /** Posts the mirror image of a transaction. The original is never edited. */
  async reverse(transactionId: string, opts: { idempotencyKey: string; createdBy?: string | null }): Promise<PostResult> {
    const original = await this.store.findTransaction(transactionId);
    if (!original) throw new LedgerError("TRANSACTION_NOT_FOUND", "transaction not found");
    if (original.kind === "REVERSAL") throw new LedgerError("INVALID_REQUEST", "a reversal cannot be reversed");
    const already = await this.store.findReversalOf(transactionId);
    if (already) throw new LedgerError("ALREADY_REVERSED", "this transaction has already been reversed");
    return this.post({
      kind: "REVERSAL",
      idempotencyKey: opts.idempotencyKey,
      description: `Reversal of ${original.description}`,
      reference: original.reference,
      reversesId: transactionId,
      createdBy: opts.createdBy ?? null,
      entries: original.entries.map((e) => ({ accountId: e.accountId, side: flip(e.side), amountMinor: e.amountMinor, currency: e.currency })),
    });
  }

  async getBalances(accountIds: string[]): Promise<Map<string, bigint>> {
    return this.store.getBalances(accountIds);
  }

  async listEntries(accountIds: string[], limit = 50) {
    return this.store.listEntries(accountIds, Math.min(Math.max(limit, 1), 200));
  }

  async totalsByKind(accountIds: string[]) {
    return this.store.totalsByKind(accountIds);
  }

  /** Recorded balance versus the balance implied by entries. Differences are written as open records. */
  async reconcile(now: Date = new Date()): Promise<{ checked: number; mismatches: { accountId: string; expectedMinor: bigint; recordedMinor: bigint }[] }> {
    const snapshot = await this.store.reconciliationSnapshot();
    const mismatches = snapshot
      .filter((s) => s.recordedMinor !== s.netFromEntriesMinor)
      .map((s) => ({ accountId: s.accountId, expectedMinor: s.netFromEntriesMinor, recordedMinor: s.recordedMinor }));
    if (mismatches.length) await this.store.recordReconciliation(mismatches, now);
    return { checked: snapshot.length, mismatches };
  }

  // ------------------------------------------------------------------ account helpers

  /** Customer account on one of its currency purposes: AVAILABLE (spendable) or HOLD (reserved for a pending transfer). */
  customerAccount(customerId: string, currency: string, purpose: "AVAILABLE" | "HOLD"): Promise<LedgerAccountRecord> {
    assertCurrency(currency);
    return this.store.getOrCreateAccount({ ownerType: "CUSTOMER", ownerId: customerId, currency, purpose, normalSide: "CREDIT", allowNegative: false });
  }

  /** Platform account. SETTLEMENT is an asset (debit normal) and may run negative while partners settle. */
  platformAccount(currency: string, purpose: "SETTLEMENT" | "FEES" | "SUSPENSE" | "RESERVE" | "FX_POSITION"): Promise<LedgerAccountRecord> {
    assertCurrency(currency);
    const normalSide: Side = purpose === "SETTLEMENT" || purpose === "RESERVE" || purpose === "FX_POSITION" ? "DEBIT" : "CREDIT";
    return this.store.getOrCreateAccount({ ownerType: "PLATFORM", ownerId: "platform", currency, purpose, normalSide, allowNegative: true });
  }

  // ------------------------------------------------------------------ money movements

  /**
   * Records a deposit that a payment partner has confirmed. Phase 6 calls this from the verified webhook
   * path only. There is no public endpoint: a deposit is never created from a client request.
   */
  async recordVerifiedDeposit(input: { customerId: string; currency: string; amountMinor: bigint; providerRef: string; idempotencyKey: string }): Promise<PostResult> {
    const [available, settlement] = await Promise.all([
      this.customerAccount(input.customerId, input.currency, "AVAILABLE"),
      this.platformAccount(input.currency, "SETTLEMENT"),
    ]);
    return this.post({
      kind: "DEPOSIT",
      idempotencyKey: input.idempotencyKey,
      description: "Deposit confirmed by payment partner",
      reference: input.providerRef,
      entries: [
        { accountId: settlement.id, side: "DEBIT", amountMinor: input.amountMinor, currency: input.currency },
        { accountId: available.id, side: "CREDIT", amountMinor: input.amountMinor, currency: input.currency },
      ],
    });
  }

  /** Reserves funds for a transfer that has been accepted by a partner but not yet confirmed. */
  async holdFunds(input: { customerId: string; currency: string; amountMinor: bigint; idempotencyKey: string; reference?: string }): Promise<PostResult> {
    const [available, hold] = await Promise.all([
      this.customerAccount(input.customerId, input.currency, "AVAILABLE"),
      this.customerAccount(input.customerId, input.currency, "HOLD"),
    ]);
    return this.post({
      kind: "TRANSFER_HOLD",
      idempotencyKey: input.idempotencyKey,
      description: "Funds reserved for transfer",
      reference: input.reference ?? null,
      entries: [
        { accountId: available.id, side: "DEBIT", amountMinor: input.amountMinor, currency: input.currency },
        { accountId: hold.id, side: "CREDIT", amountMinor: input.amountMinor, currency: input.currency },
      ],
    });
  }

  /** Partner confirmed the transfer: reserved funds leave the customer and go to the settlement account. */
  async settleHold(input: { customerId: string; currency: string; amountMinor: bigint; idempotencyKey: string; reference?: string }): Promise<PostResult> {
    const [hold, settlement] = await Promise.all([
      this.customerAccount(input.customerId, input.currency, "HOLD"),
      this.platformAccount(input.currency, "SETTLEMENT"),
    ]);
    return this.post({
      kind: "TRANSFER_SETTLE",
      idempotencyKey: input.idempotencyKey,
      description: "Transfer confirmed by payment partner",
      reference: input.reference ?? null,
      entries: [
        { accountId: hold.id, side: "DEBIT", amountMinor: input.amountMinor, currency: input.currency },
        { accountId: settlement.id, side: "CREDIT", amountMinor: input.amountMinor, currency: input.currency },
      ],
    });
  }

  /** Transfer failed or was cancelled: reserved funds return to the customer's spendable balance. */
  async releaseHold(input: { customerId: string; currency: string; amountMinor: bigint; idempotencyKey: string; reference?: string }): Promise<PostResult> {
    const [available, hold] = await Promise.all([
      this.customerAccount(input.customerId, input.currency, "AVAILABLE"),
      this.customerAccount(input.customerId, input.currency, "HOLD"),
    ]);
    return this.post({
      kind: "TRANSFER_RELEASE",
      idempotencyKey: input.idempotencyKey,
      description: "Reserved funds released",
      reference: input.reference ?? null,
      entries: [
        { accountId: hold.id, side: "DEBIT", amountMinor: input.amountMinor, currency: input.currency },
        { accountId: available.id, side: "CREDIT", amountMinor: input.amountMinor, currency: input.currency },
      ],
    });
  }
}

// ---------------------------------------------------------------------- helpers

function validateRequest(req: PostRequest): void {
  if (req.idempotencyKey.length < 8 || req.idempotencyKey.length > 128) {
    throw new LedgerError("INVALID_REQUEST", "idempotency key must be 8 to 128 characters");
  }
  if (req.entries.length < 2) throw new LedgerError("INVALID_REQUEST", "a posting needs at least two entries");
  if (req.description.trim().length === 0) throw new LedgerError("INVALID_REQUEST", "description is required");
  for (const e of req.entries) {
    if (typeof e.amountMinor !== "bigint" || e.amountMinor <= 0n) throw new LedgerError("INVALID_REQUEST", "amounts must be positive integers in minor units");
    if (e.side !== "DEBIT" && e.side !== "CREDIT") throw new LedgerError("INVALID_REQUEST", "side must be DEBIT or CREDIT");
    assertCurrency(e.currency);
  }
}

function assertCurrency(code: string): void {
  if (!isLaunchCurrency(code)) throw new LedgerError("CURRENCY_MISMATCH", `${code} is not a launch currency`);
}

function checkAccounts(entries: EntryInput[], accounts: LedgerAccountRecord[]): void {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  for (const e of entries) {
    const acct = byId.get(e.accountId);
    if (!acct) throw new LedgerError("ACCOUNT_NOT_FOUND", `ledger account ${e.accountId} not found`);
    if (acct.currency !== e.currency) throw new LedgerError("CURRENCY_MISMATCH", `entry in ${e.currency} posted to a ${acct.currency} account`);
  }
}

function checkBalancedPerCurrency(entries: EntryInput[]): void {
  const net = new Map<string, bigint>();
  for (const e of entries) {
    const signed = e.side === "DEBIT" ? e.amountMinor : -e.amountMinor;
    net.set(e.currency, (net.get(e.currency) ?? 0n) + signed);
  }
  for (const [currency, value] of net) {
    if (value !== 0n) throw new LedgerError("UNBALANCED", `entries do not balance in ${currency} (net ${value})`);
  }
}

/** Signed change to each account's stored balance, given its normal side. */
export function netDeltas(entries: EntryInput[], accounts: LedgerAccountRecord[]): { accountId: string; delta: bigint }[] {
  const normal = new Map(accounts.map((a) => [a.id, a.normalSide]));
  const sums = new Map<string, bigint>();
  for (const e of entries) {
    const sameSide = normal.get(e.accountId) === e.side;
    const signed = sameSide ? e.amountMinor : -e.amountMinor;
    sums.set(e.accountId, (sums.get(e.accountId) ?? 0n) + signed);
  }
  return [...sums.entries()]
    .filter(([, d]) => d !== 0n)
    .map(([accountId, delta]) => ({ accountId, delta }))
    .sort((a, b) => (a.accountId < b.accountId ? -1 : a.accountId > b.accountId ? 1 : 0));
}

export function hashRequest(req: PostRequest): string {
  const canonical = {
    kind: req.kind,
    description: req.description,
    reference: req.reference ?? null,
    reversesId: req.reversesId ?? null,
    entries: [...req.entries]
      .map((e) => ({ accountId: e.accountId, side: e.side, amountMinor: e.amountMinor.toString(), currency: e.currency }))
      .sort((a, b) => (a.accountId + a.side + a.amountMinor).localeCompare(b.accountId + b.side + b.amountMinor)),
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function replayOrConflict(existing: TxWithEntries, requestHash: string): PostResult {
  if (existing.requestHash !== requestHash) {
    throw new LedgerError("IDEMPOTENCY_CONFLICT", "this idempotency key was used for a different request");
  }
  return { transaction: existing, replayed: true };
}

function flip(side: Side): Side {
  return side === "DEBIT" ? "CREDIT" : "DEBIT";
}

export { CURRENCY_META };
export type { AccountSpec, TxKind };
