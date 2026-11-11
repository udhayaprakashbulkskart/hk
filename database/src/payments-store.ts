import { PaymentError, type Direction, type Environment, type NewPayment, type PaymentMethod, type PaymentRecord, type PaymentStatus, type PaymentStore, type ProviderId, type WebhookRecord } from "@hkfinhub/payments";
import type { Database } from "./client";
import { Prisma } from "./generated/prisma/client";

type Tx = Omit<Database, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;
const P2002 = "P2002";

type PaymentRow = {
  id: string; direction: string; providerId: string; environment: string; providerRef: string | null; reference: string;
  idempotencyKey: string; accountId: string; currency: string; amountMinor: bigint; method: string; country: string;
  status: string; transferId: string | null; metadata: Prisma.JsonValue; ledgerTransactionId: string | null;
  createdAt: Date; updatedAt: Date;
};

function toPayment(r: PaymentRow): PaymentRecord {
  return {
    ...r,
    direction: r.direction as Direction,
    providerId: r.providerId as ProviderId,
    environment: r.environment as Environment,
    method: r.method as PaymentMethod,
    status: r.status as PaymentStatus,
    metadata: (r.metadata ?? {}) as Record<string, string>,
  };
}

/** Prisma store for payments, webhooks and the provider route table. */
export class PrismaPaymentStore implements PaymentStore {
  constructor(private readonly db: Database | Tx) {}
  private get q(): Tx {
    return this.db as Tx;
  }

  async transaction<T>(fn: (tx: PaymentStore) => Promise<T>): Promise<T> {
    return (this.db as Database).$transaction((tx) => fn(new PrismaPaymentStore(tx as unknown as Tx)), { isolationLevel: "ReadCommitted" });
  }

  async findByIdempotencyKey(key: string) {
    const r = await this.q.payment.findUnique({ where: { idempotencyKey: key } });
    return r ? toPayment(r as unknown as PaymentRow) : null;
  }

  async insertPayment(p: NewPayment): Promise<PaymentRecord> {
    try {
      const r = await this.q.payment.create({
        data: {
          direction: p.direction,
          providerId: p.providerId,
          environment: p.environment,
          reference: p.reference,
          idempotencyKey: p.idempotencyKey,
          accountId: p.accountId,
          currency: p.currency,
          amountMinor: p.amountMinor,
          method: p.method,
          country: p.country,
          status: "CREATED",
          transferId: p.transferId,
          metadata: p.metadata as Prisma.InputJsonValue,
        },
      });
      return toPayment(r as unknown as PaymentRow);
    } catch (err) {
      if (typeof err === "object" && err !== null && (err as { code?: string }).code === P2002) {
        throw new PaymentError("IDEMPOTENCY_CONFLICT", "this payment already exists");
      }
      throw err;
    }
  }

  async findPayment(id: string) {
    const r = await this.q.payment.findUnique({ where: { id } });
    return r ? toPayment(r as unknown as PaymentRow) : null;
  }

  async findByProviderRef(providerId: ProviderId, providerRef: string) {
    const r = await this.q.payment.findUnique({ where: { providerId_providerRef: { providerId, providerRef } } });
    return r ? toPayment(r as unknown as PaymentRow) : null;
  }

  async setProviderRef(id: string, providerRef: string, status: PaymentStatus, now: Date) {
    await this.q.payment.update({ where: { id }, data: { providerRef, status, updatedAt: now } });
  }

  async moveStatus(id: string, from: PaymentStatus[], to: PaymentStatus, now: Date, failureReason?: string) {
    const r = await this.q.payment.updateMany({
      where: { id, status: { in: from } },
      data: { status: to, updatedAt: now, ...(failureReason ? { failureReason } : {}) },
    });
    return r.count === 1;
  }

  async setLedgerTransaction(id: string, ledgerTransactionId: string, now: Date) {
    await this.q.payment.update({ where: { id }, data: { ledgerTransactionId, updatedAt: now } });
  }

  async upsertWebhook(input: { providerId: ProviderId; eventId: string; type: string; payload: unknown; now: Date }): Promise<{ record: WebhookRecord; created: boolean }> {
    try {
      const r = await this.q.providerWebhook.create({
        data: { providerId: input.providerId, eventId: input.eventId, type: input.type, payload: input.payload as Prisma.InputJsonValue, receivedAt: input.now },
      });
      return { record: { ...r, providerId: r.providerId as ProviderId }, created: true };
    } catch (err) {
      if (typeof err === "object" && err !== null && (err as { code?: string }).code === P2002) {
        const existing = await this.q.providerWebhook.findUniqueOrThrow({ where: { providerId_eventId: { providerId: input.providerId, eventId: input.eventId } } });
        return { record: { ...existing, providerId: existing.providerId as ProviderId }, created: false };
      }
      throw err;
    }
  }

  async markWebhookProcessed(id: string, outcome: string, now: Date) {
    await this.q.providerWebhook.update({ where: { id }, data: { processedAt: now, outcome } });
  }

  async findRoutes(q: { direction: Direction; country: string; currency: string; method: PaymentMethod; environment: Environment }) {
    const rows = await this.q.providerCapability.findMany({
      where: { direction: q.direction, country: q.country, currency: q.currency, method: q.method, environment: q.environment, enabled: true },
      orderBy: { providerId: "asc" },
    });
    return rows.map((r) => ({ providerId: r.providerId as ProviderId }));
  }

  async hasProviderApproval(providerId: ProviderId, environment: Environment) {
    return (await this.q.providerApproval.count({ where: { providerId, environment } })) > 0;
  }
}
