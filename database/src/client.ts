import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

export type Database = PrismaClient;

/** One pooled Prisma client per process. Pool size is bounded so a burst cannot exhaust Postgres. */
export function createDatabase(connectionString: string, opts: { max?: number } = {}): Database {
  const adapter = new PrismaPg({ connectionString, max: opts.max ?? 10 });
  return new PrismaClient({ adapter });
}
