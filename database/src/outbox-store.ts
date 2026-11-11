import type { OutboxStore } from "@hkfinhub/notifications";
import type { Database } from "./client";
import { Prisma } from "./generated/prisma/client";

type Tx = Omit<Database, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">;

/** Prisma implementation of the notifications OutboxStore port. */
export class PrismaOutboxStore implements OutboxStore {
  constructor(private readonly db: Database | Tx) {}

  private get q(): Tx {
    return this.db as Tx;
  }

  async transaction<T>(fn: (tx: OutboxStore) => Promise<T>): Promise<T> {
    return (this.db as Database).$transaction((tx) => fn(new PrismaOutboxStore(tx as unknown as Tx)), { isolationLevel: "ReadCommitted", maxWait: 5000, timeout: 15000 });
  }

  /** FOR UPDATE SKIP LOCKED: parallel relays claim disjoint rows. Only valid inside transaction(). */
  async claimUnpublished(limit: number) {
    const rows = await this.q.$queryRaw<{ id: string; type: string; payload: Prisma.JsonValue }[]>`
      SELECT "id", "type", "payload"
      FROM "OutboxEvent"
      WHERE "publishedAt" IS NULL
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED`;
    return rows.map((r) => ({ id: r.id, type: r.type, payload: (r.payload ?? {}) as Record<string, unknown> }));
  }

  async markPublished(ids: string[], now: Date) {
    await this.q.outboxEvent.updateMany({ where: { id: { in: ids } }, data: { publishedAt: now } });
  }

  async redact(id: string, now: Date) {
    await this.q.outboxEvent.update({
      where: { id },
      data: { payload: { redacted: true, redactedAt: now.toISOString() } as Prisma.InputJsonValue, publishedAt: now },
    });
  }

  async loadContact(userId: string) {
    const u = await this.q.user.findUnique({ where: { id: userId }, select: { email: true, phoneE164: true, profile: { select: { fullName: true } } } });
    if (!u) return null;
    return { email: u.email, phoneE164: u.phoneE164, fullName: u.profile?.fullName ?? "" };
  }

  async createInApp(input: { userId: string; category: string; title: string; body: string; now: Date }) {
    await this.q.notification.create({
      data: { userId: input.userId, category: input.category, title: input.title, body: input.body, createdAt: input.now },
    });
  }
}
