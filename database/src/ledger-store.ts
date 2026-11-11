import { DuplicateKeyError, InsufficientFundsError, type AccountSpec, type ApprovalRecord, type EntryInput, type LedgerAccountRecord, type LedgerStore, type NewTx, type Side, type TxKind, type TxRecord, type TxWithEntries } from "@hkfinhub/ledger";
import type { Database } from "./client";
import { Prisma } from "./generated/prisma/client";

type Tx = Omit<Database, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

const P2002 = "P2002";
const INSUFFICIENT = "insufficient funds";

function toAccount(a: { id: string; ownerType: string; ownerId: string; currency: string; purpose: string; normalSide: string; allowNegative: boolean }): LedgerAccountRecord {
  return { id: a.id, ownerType: a.ownerType as "CUSTOMER" | "PLATFORM", ownerId: a.ownerId, currency: a.currency, purpose: a.purpose, normalSide: a.normalSide as Side, allowNegative: a.allowNegative };
}

function toTx(t: { id: string; kind: string; idempotencyKey: string; requestHash: string; description: string; reference: string | null; reversesId: string | null; createdBy: string | null; postedAt: Date }): TxRecord {
  return { ...t, kind: t.kind as TxKind };
}

/** Prisma implementation of the ledger store. Balance changes run as SQL under the write flag. */
export class PrismaLedgerStore implements LedgerStore {
  constructor(private readonly db: Database | Tx) {}

  private get q(): Tx {
    return this.db as Tx;
  }

  async transaction<T>(fn: (tx: LedgerStore) => Promise<T>): Promise<T> {
    try {
      return await (this.db as Database).$transaction((tx) => fn(new PrismaLedgerStore(tx as unknown as Tx)), {
        isolationLevel: "ReadCommitted",
        maxWait: 5000,
        timeout: 15000,
      });
    } catch (err) {
      throw translate(err);
    }
  }

  async getOrCreateAccount(spec: AccountSpec): Promise<LedgerAccountRecord> {
    const a = await this.q.ledgerAccount.upsert({
      where: { ownerType_ownerId_currency_purpose: { ownerType: spec.ownerType, ownerId: spec.ownerId, currency: spec.currency, purpose: spec.purpose } },
      create: { ownerType: spec.ownerType, ownerId: spec.ownerId, currency: spec.currency, purpose: spec.purpose, normalSide: spec.normalSide, allowNegative: spec.allowNegative },
      update: {},
    });
    return toAccount(a);
  }

  async getAccounts(ids: string[]): Promise<LedgerAccountRecord[]> {
    const rows = await this.q.ledgerAccount.findMany({ where: { id: { in: ids } } });
    return rows.map(toAccount);
  }

  async findTransactionByKey(key: string): Promise<TxWithEntries | null> {
    const t = await this.q.ledgerTransaction.findUnique({ where: { idempotencyKey: key }, include: { entries: true } });
    return t ? withEntries(t) : null;
  }

  async findTransaction(id: string): Promise<TxWithEntries | null> {
    const t = await this.q.ledgerTransaction.findUnique({ where: { id }, include: { entries: true } });
    return t ? withEntries(t) : null;
  }

  async findReversalOf(id: string): Promise<TxRecord | null> {
    const t = await this.q.ledgerTransaction.findUnique({ where: { reversesId: id } });
    return t ? toTx(t) : null;
  }

  async insertTransaction(tx: NewTx): Promise<void> {
    try {
      await this.q.ledgerTransaction.create({
        data: {
          id: tx.id,
          kind: tx.kind,
          idempotencyKey: tx.idempotencyKey,
          requestHash: tx.requestHash,
          description: tx.description,
          reference: tx.reference,
          reversesId: tx.reversesId,
          createdBy: tx.createdBy,
        },
      });
    } catch (err) {
      if (isUnique(err)) {
        const target = uniqueTarget(err);
        throw new DuplicateKeyError(target === "reversesId" ? "reversesId" : "idempotencyKey");
      }
      throw err;
    }
  }

  async insertEntries(transactionId: string, entries: EntryInput[]): Promise<void> {
    await this.q.ledgerEntry.createMany({
      data: entries.map((e) => ({ transactionId, ledgerAccountId: e.accountId, side: e.side, amountMinor: e.amountMinor, currency: e.currency })),
    });
  }

  /** Sets the transaction-local flag that the database requires before any balance changes. */
  async enableBalanceWrites(): Promise<void> {
    await this.q.$executeRaw`SELECT set_config('hkf.ledger_write', 'on', true)`;
  }

  /**
   * Update first, insert only when the balance row does not exist yet. An INSERT ... ON CONFLICT would
   * fire the insert-time floor check on the proposed row before the conflict is resolved, so a debit
   * to an existing account could be refused for the wrong reason. The row lock taken by UPDATE is what
   * serialises concurrent postings on the same account.
   */
  async applyBalanceDeltas(deltas: { accountId: string; delta: bigint }[]): Promise<void> {
    for (const { accountId, delta } of deltas) {
      try {
        const updated = await this.q.$executeRaw`
          UPDATE "LedgerBalance"
          SET "balanceMinor" = "balanceMinor" + ${delta}, "updatedAt" = now()
          WHERE "ledgerAccountId" = ${accountId}`;
        if (updated === 0) {
          try {
            await this.q.$executeRaw`
              INSERT INTO "LedgerBalance" ("ledgerAccountId", "balanceMinor", "updatedAt")
              VALUES (${accountId}, ${delta}, now())`;
          } catch (err) {
            // Another posting created the row first: apply our change as an update instead.
            if (!isUnique(err)) throw err;
            await this.q.$executeRaw`
              UPDATE "LedgerBalance"
              SET "balanceMinor" = "balanceMinor" + ${delta}, "updatedAt" = now()
              WHERE "ledgerAccountId" = ${accountId}`;
          }
        }
      } catch (err) {
        if (isInsufficient(err)) throw new InsufficientFundsError();
        throw err;
      }
    }
  }

  async getBalances(accountIds: string[]): Promise<Map<string, bigint>> {
    const rows = await this.q.ledgerBalance.findMany({ where: { ledgerAccountId: { in: accountIds } } });
    const out = new Map<string, bigint>(accountIds.map((id) => [id, 0n]));
    for (const r of rows) out.set(r.ledgerAccountId, r.balanceMinor);
    return out;
  }

  async listEntries(accountIds: string[], limit: number) {
    const rows = await this.q.ledgerEntry.findMany({
      where: { ledgerAccountId: { in: accountIds } },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { transaction: true },
    });
    return rows.map((e) => ({
      accountId: e.ledgerAccountId,
      side: e.side as Side,
      amountMinor: e.amountMinor,
      currency: e.currency,
      transactionId: e.transactionId,
      kind: e.transaction.kind as TxKind,
      description: e.transaction.description,
      reference: e.transaction.reference,
      postedAt: e.transaction.postedAt,
    })) as never;
  }

  async totalsByKind(accountIds: string[]) {
    const rows = await this.q.$queryRaw<{ kind: string; side: string; currency: string; total: bigint }[]>`
      SELECT t."kind" AS kind, e."side" AS side, e."currency" AS currency, SUM(e."amountMinor") AS total
      FROM "LedgerEntry" e
      JOIN "LedgerTransaction" t ON t."id" = e."transactionId"
      WHERE e."ledgerAccountId" IN (${Prisma.join(accountIds)})
      GROUP BY t."kind", e."side", e."currency"`;
    return rows.map((r) => ({ kind: r.kind as TxKind, side: r.side as Side, currency: r.currency, amountMinor: BigInt(r.total) }));
  }

  async reconciliationSnapshot() {
    const rows = await this.q.$queryRaw<{ id: string; normalSide: string; recorded: bigint | null; net: bigint | null }[]>`
      SELECT a."id", a."normalSide"::text AS "normalSide",
        (SELECT b."balanceMinor" FROM "LedgerBalance" b WHERE b."ledgerAccountId" = a."id") AS recorded,
        (SELECT SUM(CASE WHEN e."side"::text = a."normalSide"::text THEN e."amountMinor" ELSE -e."amountMinor" END)
           FROM "LedgerEntry" e WHERE e."ledgerAccountId" = a."id") AS net
      FROM "LedgerAccount" a`;
    return rows.map((r) => ({
      accountId: r.id,
      normalSide: r.normalSide as Side,
      recordedMinor: BigInt(r.recorded ?? 0),
      netFromEntriesMinor: BigInt(r.net ?? 0),
    }));
  }

  async recordReconciliation(rows: { accountId: string; expectedMinor: bigint; recordedMinor: bigint }[], runAt: Date): Promise<void> {
    await this.q.reconciliationRecord.createMany({
      data: rows.map((r) => ({ ledgerAccountId: r.accountId, expectedMinor: r.expectedMinor, recordedMinor: r.recordedMinor, status: "OPEN", runAt })),
    });
  }

  async createApproval(rec: Omit<ApprovalRecord, "status" | "decidedBy"> & { id: string }): Promise<void> {
    await this.q.approvalRequest.create({ data: { id: rec.id, action: rec.action, payload: rec.payload as Prisma.InputJsonValue, requestedBy: rec.requestedBy } });
  }

  async findApproval(id: string): Promise<ApprovalRecord | null> {
    const a = await this.q.approvalRequest.findUnique({ where: { id } });
    return a ? { id: a.id, action: a.action, payload: a.payload as Record<string, unknown>, requestedBy: a.requestedBy, status: a.status, decidedBy: a.decidedBy } : null;
  }

  async decideApproval(id: string, status: "APPROVED" | "REJECTED", decidedBy: string, now: Date): Promise<boolean> {
    const r = await this.q.approvalRequest.updateMany({ where: { id, status: "PENDING" }, data: { status, decidedBy, decidedAt: now } });
    return r.count === 1;
  }
}

function withEntries(t: TxRecord & { entries: { id: string; ledgerAccountId: string; side: string; amountMinor: bigint; currency: string }[] }): TxWithEntries {
  return {
    ...toTx(t),
    entries: t.entries.map((e) => ({ id: e.id, accountId: e.ledgerAccountId, side: e.side as Side, amountMinor: e.amountMinor, currency: e.currency })),
  };
}

function isUnique(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === P2002;
}

function uniqueTarget(err: unknown): string {
  const meta = (err as { meta?: { target?: unknown } }).meta;
  return JSON.stringify(meta?.target ?? "");
}

function isInsufficient(err: unknown): boolean {
  return String(err instanceof Error ? err.message : err).includes(INSUFFICIENT);
}

/** Maps database-level errors that the service must see as domain errors. */
function translate(err: unknown): unknown {
  if (err instanceof DuplicateKeyError || err instanceof InsufficientFundsError) return err;
  if (isInsufficient(err)) return new InsufficientFundsError();
  return err;
}
