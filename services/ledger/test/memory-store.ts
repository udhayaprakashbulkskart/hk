import { randomUUID } from "node:crypto";
import { DuplicateKeyError, InsufficientFundsError } from "../src/errors";
import type { AccountSpec, ApprovalRecord, EntryInput, LedgerAccountRecord, LedgerStore, NewTx, Side, TxKind, TxRecord, TxWithEntries } from "../src/ports";

/**
 * In-memory LedgerStore for property tests. It mirrors the database rules that matter here:
 * immutable records, no overdraft on customer accounts, unique idempotency keys and reversal targets,
 * and all-or-nothing transactions. The Postgres store is tested against the real database separately.
 */
interface State {
  accounts: Map<string, LedgerAccountRecord & { balance: bigint }>;
  txs: Map<string, TxWithEntries>;
  byKey: Map<string, string>;
  reversedBy: Map<string, string>;
  approvals: Map<string, ApprovalRecord>;
}

export class MemoryLedgerStore implements LedgerStore {
  private state: State = { accounts: new Map(), txs: new Map(), byKey: new Map(), reversedBy: new Map(), approvals: new Map() };

  /** Non-zero balances only: creating an empty account is bookkeeping, not money movement. */
  snapshot(): string {
    return JSON.stringify([...this.state.accounts.values()].filter((a) => a.balance !== 0n).map((a) => [a.id, a.balance.toString()]).sort());
  }

  balanceOf(id: string): bigint {
    return this.state.accounts.get(id)?.balance ?? 0n;
  }

  allAccounts() {
    return [...this.state.accounts.values()];
  }

  async transaction<T>(fn: (tx: LedgerStore) => Promise<T>): Promise<T> {
    // Atomicity: copy the state, run, and restore the copy if anything throws.
    const backup: State = {
      accounts: new Map([...this.state.accounts].map(([k, v]) => [k, { ...v }])),
      txs: new Map(this.state.txs),
      byKey: new Map(this.state.byKey),
      reversedBy: new Map(this.state.reversedBy),
      approvals: new Map(this.state.approvals),
    };
    try {
      return await fn(this);
    } catch (err) {
      this.state = backup;
      throw err;
    }
  }

  async getOrCreateAccount(spec: AccountSpec): Promise<LedgerAccountRecord> {
    const key = `${spec.ownerType}|${spec.ownerId}|${spec.currency}|${spec.purpose}`;
    let found = [...this.state.accounts.values()].find((a) => `${a.ownerType}|${a.ownerId}|${a.currency}|${a.purpose}` === key);
    if (!found) {
      found = { id: randomUUID(), ...spec, balance: 0n };
      this.state.accounts.set(found.id, found);
    }
    return { id: found.id, ownerType: found.ownerType, ownerId: found.ownerId, currency: found.currency, purpose: found.purpose, normalSide: found.normalSide, allowNegative: found.allowNegative };
  }

  async getAccounts(ids: string[]): Promise<LedgerAccountRecord[]> {
    return ids.map((id) => this.state.accounts.get(id)).filter((a): a is LedgerAccountRecord & { balance: bigint } => a !== undefined).map(({ balance: _b, ...rest }) => rest);
  }

  async findTransactionByKey(key: string) {
    const id = this.state.byKey.get(key);
    return id ? this.state.txs.get(id) ?? null : null;
  }

  async findTransaction(id: string) {
    return this.state.txs.get(id) ?? null;
  }

  async findReversalOf(id: string): Promise<TxRecord | null> {
    const rid = this.state.reversedBy.get(id);
    return rid ? (this.state.txs.get(rid) as TxRecord) ?? null : null;
  }

  async insertTransaction(tx: NewTx): Promise<void> {
    if (this.state.byKey.has(tx.idempotencyKey)) throw new DuplicateKeyError("idempotencyKey");
    if (tx.reversesId && this.state.reversedBy.has(tx.reversesId)) throw new DuplicateKeyError("reversesId");
    this.state.byKey.set(tx.idempotencyKey, tx.id);
    if (tx.reversesId) this.state.reversedBy.set(tx.reversesId, tx.id);
    this.state.txs.set(tx.id, {
      id: tx.id,
      kind: tx.kind as TxKind,
      idempotencyKey: tx.idempotencyKey,
      requestHash: tx.requestHash,
      description: tx.description,
      reference: tx.reference,
      reversesId: tx.reversesId,
      createdBy: tx.createdBy,
      postedAt: new Date(0),
      entries: [],
    });
  }

  async insertEntries(transactionId: string, entries: EntryInput[]): Promise<void> {
    const tx = this.state.txs.get(transactionId);
    if (!tx) throw new Error("no transaction");
    tx.entries.push(...entries.map((e) => ({ id: randomUUID(), ...e })));
  }

  async enableBalanceWrites(): Promise<void> {
    // The database flag; nothing to do in memory.
  }

  async applyBalanceDeltas(deltas: { accountId: string; delta: bigint }[]): Promise<void> {
    for (const { accountId, delta } of deltas) {
      const acct = this.state.accounts.get(accountId);
      if (!acct) throw new Error("missing account");
      const next = acct.balance + delta;
      if (next < 0n && !acct.allowNegative) throw new InsufficientFundsError();
      acct.balance = next;
    }
  }

  async getBalances(accountIds: string[]): Promise<Map<string, bigint>> {
    return new Map(accountIds.map((id) => [id, this.state.accounts.get(id)?.balance ?? 0n]));
  }

  async listEntries(accountIds: string[], limit: number) {
    const ids = new Set(accountIds);
    const rows = [...this.state.txs.values()].flatMap((t) =>
      t.entries.filter((e) => ids.has(e.accountId)).map((e) => ({ accountId: e.accountId, side: e.side, amountMinor: e.amountMinor, currency: e.currency, transactionId: t.id, kind: t.kind, description: t.description, reference: t.reference, postedAt: t.postedAt })),
    );
    return rows.slice(0, limit).map(({ accountId: _a, ...rest }) => ({ ...rest, accountId: _a }) as never);
  }

  async totalsByKind(accountIds: string[]) {
    const ids = new Set(accountIds);
    const out = new Map<string, { kind: TxKind; side: Side; currency: string; amountMinor: bigint }>();
    for (const t of this.state.txs.values()) {
      for (const e of t.entries) {
        if (!ids.has(e.accountId)) continue;
        const k = `${t.kind}|${e.side}|${e.currency}`;
        const cur = out.get(k) ?? { kind: t.kind, side: e.side, currency: e.currency, amountMinor: 0n };
        cur.amountMinor += e.amountMinor;
        out.set(k, cur);
      }
    }
    return [...out.values()];
  }

  async reconciliationSnapshot() {
    return [...this.state.accounts.values()].map((a) => {
      let net = 0n;
      for (const t of this.state.txs.values()) {
        for (const e of t.entries) if (e.accountId === a.id) net += e.side === a.normalSide ? e.amountMinor : -e.amountMinor;
      }
      return { accountId: a.id, normalSide: a.normalSide, recordedMinor: a.balance, netFromEntriesMinor: net };
    });
  }

  async recordReconciliation(): Promise<void> {
    // Not exercised by the property tests.
  }

  async createApproval(rec: Omit<ApprovalRecord, "status" | "decidedBy"> & { id: string }): Promise<void> {
    this.state.approvals.set(rec.id, { ...rec, status: "PENDING", decidedBy: null });
  }

  async findApproval(id: string) {
    return this.state.approvals.get(id) ?? null;
  }

  async decideApproval(id: string, status: "APPROVED" | "REJECTED", decidedBy: string): Promise<boolean> {
    const a = this.state.approvals.get(id);
    if (!a || a.status !== "PENDING") return false;
    a.status = status;
    a.decidedBy = decidedBy;
    return true;
  }
}
