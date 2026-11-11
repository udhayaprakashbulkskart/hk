import type { NewTransfer, PaymentRequestRecord, RequestStore, TransferRecord, TransferStatus, TransferStore } from "@hkfinhub/transfers";
import type { Database } from "./client";
import { Prisma } from "./generated/prisma/client";
import { acquireAccountLocks } from "./locks";

type Tx = Omit<Database, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

function toTransfer(r: Record<string, unknown>): TransferRecord {
  return r as unknown as TransferRecord;
}

export class PrismaTransferStore implements TransferStore {
  constructor(private readonly db: Database | Tx) {}
  private get q(): Tx {
    return this.db as Tx;
  }

  async transaction<T>(fn: (tx: TransferStore) => Promise<T>): Promise<T> {
    return (this.db as Database).$transaction((tx) => fn(new PrismaTransferStore(tx as unknown as Tx)), { isolationLevel: "ReadCommitted", timeout: 20000 });
  }

  async lockAccounts(accountIds: string[]): Promise<void> {
    await acquireAccountLocks(this.q, accountIds);
  }

  async findByKey(key: string) {
    const r = await this.q.transfer.findUnique({ where: { idempotencyKey: key } });
    return r ? toTransfer(r as unknown as Record<string, unknown>) : null;
  }

  async findById(id: string) {
    const r = await this.q.transfer.findUnique({ where: { id } });
    return r ? toTransfer(r as unknown as Record<string, unknown>) : null;
  }

  async findByPaymentId(paymentId: string) {
    const r = await this.q.transfer.findUnique({ where: { paymentId } });
    return r ? toTransfer(r as unknown as Record<string, unknown>) : null;
  }

  async listForAccount(accountId: string, limit: number) {
    const rows = await this.q.transfer.findMany({ where: { accountId }, orderBy: { createdAt: "desc" }, take: limit });
    return rows.map((r) => toTransfer(r as unknown as Record<string, unknown>));
  }

  async insert(t: NewTransfer): Promise<TransferRecord> {
    const r = await this.q.transfer.create({
      data: {
        id: t.id,
        accountId: t.accountId,
        kind: t.kind,
        status: "INITIATED",
        sourceCurrency: t.sourceCurrency,
        sourceMinor: t.sourceMinor,
        feeMinor: t.feeMinor,
        recipientCurrency: t.recipientCurrency,
        recipientMinor: t.recipientMinor,
        fxQuoteId: t.fxQuoteId,
        recipientAccountId: t.recipientAccountId,
        destinationMasked: t.destinationMasked,
        method: t.method,
        country: t.country,
        idempotencyKey: t.idempotencyKey,
      },
    });
    return toTransfer(r as unknown as Record<string, unknown>);
  }

  async setPaymentId(id: string, paymentId: string, now: Date) {
    await this.q.transfer.update({ where: { id }, data: { paymentId, updatedAt: now } });
  }

  async move(id: string, from: TransferStatus[], to: TransferStatus, now: Date, extra?: { failureReason?: string; ledgerTransactionId?: string }) {
    const r = await this.q.transfer.updateMany({
      where: { id, status: { in: from } },
      data: { status: to, updatedAt: now, ...(extra?.failureReason ? { failureReason: extra.failureReason } : {}), ...(extra?.ledgerTransactionId ? { ledgerTransactionId: extra.ledgerTransactionId } : {}) },
    });
    return r.count === 1;
  }

  async reservedMinor(accountId: string, currency: string): Promise<bigint> {
    const agg = await this.q.transfer.aggregate({
      where: { accountId, sourceCurrency: currency, status: { in: ["INITIATED", "SUBMITTED"] } },
      _sum: { sourceMinor: true },
    });
    return agg._sum.sourceMinor ?? 0n;
  }
}

export class PrismaRequestStore implements RequestStore {
  constructor(private readonly db: Database | Tx) {}
  private get q(): Tx {
    return this.db as Tx;
  }

  async insert(r: Omit<PaymentRequestRecord, "status" | "paymentId" | "paidAt">): Promise<PaymentRequestRecord> {
    const row = await this.q.paymentRequest.create({ data: { ref: r.ref, accountId: r.accountId, currency: r.currency, amountMinor: r.amountMinor, memo: r.memo, status: "OPEN", createdAt: r.createdAt } });
    return row as unknown as PaymentRequestRecord;
  }

  async findByRef(ref: string) {
    const r = await this.q.paymentRequest.findUnique({ where: { ref } });
    return (r as unknown as PaymentRequestRecord | null) ?? null;
  }

  async listForAccount(accountId: string, limit: number) {
    return (await this.q.paymentRequest.findMany({ where: { accountId }, orderBy: { createdAt: "desc" }, take: limit })) as unknown as PaymentRequestRecord[];
  }

  async cancel(ref: string, accountId: string) {
    const r = await this.q.paymentRequest.updateMany({ where: { ref, accountId, status: "OPEN" }, data: { status: "CANCELLED" } });
    return r.count === 1;
  }

  async markPaid(ref: string, paymentId: string, now: Date) {
    const r = await this.q.paymentRequest.updateMany({ where: { ref, status: "OPEN" }, data: { status: "PAID", paymentId, paidAt: now } });
    return r.count === 1;
  }
}

export { Prisma };
