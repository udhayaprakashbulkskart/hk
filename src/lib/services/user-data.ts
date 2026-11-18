import "server-only";
import { db } from "../db";

export async function getSavedIds(userId?: string | null) {
  if (!userId) return [];
  const rows = await db.wishlistItem.findMany({ where: { userId }, select: { productId: true } });
  return rows.map((r) => r.productId);
}
