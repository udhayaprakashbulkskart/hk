import type { JobQueue, OutboxStore } from "./ports";

/**
 * Moves unpublished outbox rows onto the job queue. Each row is claimed inside a transaction with
 * FOR UPDATE SKIP LOCKED, so several relays can run side by side without duplicating work.
 * The queue job id equals the outbox id, so a retry after a crash cannot create a second job.
 */
export async function relayOutbox(store: OutboxStore, queue: JobQueue, batchSize = 50, now: () => Date = () => new Date()): Promise<number> {
  return store.transaction(async (tx) => {
    const rows = await tx.claimUnpublished(batchSize);
    if (rows.length === 0) return 0;
    for (const row of rows) {
      await queue.add(row.id, { outboxId: row.id, payload: row.payload });
    }
    await tx.markPublished(rows.map((r) => r.id), now());
    return rows.length;
  });
}
