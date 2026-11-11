type RawExecutor = { $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<number> };

/**
 * Per-account advisory lock, held until the enclosing transaction ends. Every path that spends an
 * account's money takes this lock first, so a reservation and a spend cannot interleave.
 */
export async function acquireAccountLock(tx: unknown, accountId: string): Promise<void> {
  const client = tx as RawExecutor;
  await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"account:" + accountId}, 0))`;
}

/** Locks several accounts in ascending id order, so concurrent callers cannot deadlock. */
export async function acquireAccountLocks(tx: unknown, accountIds: string[]): Promise<void> {
  for (const id of [...new Set(accountIds)].sort()) {
    await acquireAccountLock(tx, id);
  }
}
