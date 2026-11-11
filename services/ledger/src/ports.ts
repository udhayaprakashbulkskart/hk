/**
 * Ledger ports. Persistence is injected. The Prisma implementation lives in packages/database.
 * Amounts are integer minor units (bigint). Balances are stored on the account's normal side:
 * a credit-normal account grows with credits, a debit-normal account grows with debits.
 */

export type Side = "DEBIT" | "CREDIT";
export type OwnerType = "CUSTOMER" | "PLATFORM";
export type TxKind =
  | "DEPOSIT" | "WITHDRAWAL" | "TRANSFER_HOLD" | "TRANSFER_SETTLE" | "TRANSFER_RELEASE"
  | "FX_CONVERSION" | "FEE" | "REVERSAL" | "ADJUSTMENT" | "TRADE_SETTLEMENT" | "INTERNAL_TRANSFER";

export interface AccountSpec {
  ownerType: OwnerType;
  ownerId: string;
  currency: string;
  purpose: string;
  normalSide: Side;
  allowNegative: boolean;
}

export interface LedgerAccountRecord extends AccountSpec {
  id: string;
}

export interface EntryInput {
  accountId: string;
  side: Side;
  amountMinor: bigint;
  currency: string;
}

export interface TxRecord {
  id: string;
  kind: TxKind;
  idempotencyKey: string;
  requestHash: string;
  description: string;
  reference: string | null;
  reversesId: string | null;
  createdBy: string | null;
  postedAt: Date;
}

export interface TxWithEntries extends TxRecord {
  entries: (EntryInput & { id: string })[];
}

export interface NewTx {
  id: string;
  kind: TxKind;
  idempotencyKey: string;
  requestHash: string;
  description: string;
  reference: string | null;
  reversesId: string | null;
  createdBy: string | null;
}

export interface ApprovalRecord {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  requestedBy: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decidedBy: string | null;
}

export interface LedgerStore {
  transaction<T>(fn: (tx: LedgerStore) => Promise<T>): Promise<T>;
  /** Creates the ledger account if missing. Safe under concurrent callers. */
  getOrCreateAccount(spec: AccountSpec): Promise<LedgerAccountRecord>;
  getAccounts(ids: string[]): Promise<LedgerAccountRecord[]>;

  findTransactionByKey(key: string): Promise<TxWithEntries | null>;
  findTransaction(id: string): Promise<TxWithEntries | null>;
  findReversalOf(id: string): Promise<TxRecord | null>;
  /** Throws DuplicateKeyError on a unique collision. */
  insertTransaction(tx: NewTx): Promise<void>;
  insertEntries(transactionId: string, entries: EntryInput[]): Promise<void>;
  /** Marks this database transaction as the one allowed to change balances. */
  enableBalanceWrites(): Promise<void>;
  /** Applies signed deltas to balances, in the order given. Throws InsufficientFundsError. */
  applyBalanceDeltas(deltas: { accountId: string; delta: bigint }[]): Promise<void>;

  getBalances(accountIds: string[]): Promise<Map<string, bigint>>;
  listEntries(accountIds: string[], limit: number): Promise<(EntryInput & { transactionId: string; kind: TxKind; description: string; reference: string | null; postedAt: Date })[]>;
  /** Totals of posted amounts per kind and side, across the given accounts. */
  totalsByKind(accountIds: string[]): Promise<{ kind: TxKind; side: Side; currency: string; amountMinor: bigint }[]>;

  /** Every account with its recorded balance and its net from entries, for reconciliation. */
  reconciliationSnapshot(): Promise<{ accountId: string; normalSide: Side; recordedMinor: bigint; netFromEntriesMinor: bigint }[]>;
  recordReconciliation(rows: { accountId: string; expectedMinor: bigint; recordedMinor: bigint }[], runAt: Date): Promise<void>;

  createApproval(rec: Omit<ApprovalRecord, "status" | "decidedBy"> & { id: string }): Promise<void>;
  findApproval(id: string): Promise<ApprovalRecord | null>;
  /** Moves a PENDING approval to a final status. Returns false if it was no longer pending. */
  decideApproval(id: string, status: "APPROVED" | "REJECTED", decidedBy: string, now: Date): Promise<boolean>;
}

export interface IdGenerator {
  next(): string;
}

export interface LedgerClock {
  now(): Date;
}
