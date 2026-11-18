import "server-only";
import { db, type Tx } from "./db";
import type { Prisma } from "@/generated/prisma/client";

export async function audit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  meta?: Prisma.InputJsonValue,
  client: Tx | typeof db = db,
) {
  await client.auditLog.create({ data: { actorId, action, entityType, entityId: entityId ?? null, meta } });
}

export async function notify(userId: string, title: string, body: string, link?: string, client: Tx | typeof db = db) {
  await client.notification.create({ data: { userId, title, body, link } });
}
