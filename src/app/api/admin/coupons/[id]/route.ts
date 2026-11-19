import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

/** Toggle active state (full edits = delete + recreate keeps redemption history honest). */
export const PATCH = handler<{ id: string }>(async (req, { id }) => {
  const admin = await requireRole("ADMIN");
  const { isActive } = await parseBody(req, z.object({ isActive: z.boolean() }));
  await db.coupon.update({ where: { id }, data: { isActive } });
  await audit(admin.id, "admin.coupon.toggle", "Coupon", id, { isActive });
  return ok({});
});

export const DELETE = handler<{ id: string }>(async (_req, { id }) => {
  const admin = await requireRole("ADMIN");
  const used = await db.couponRedemption.count({ where: { couponId: id } });
  // Used coupons are deactivated rather than deleted so order history keeps its reference.
  if (used) await db.coupon.update({ where: { id }, data: { isActive: false } });
  else await db.coupon.delete({ where: { id } });
  await audit(admin.id, used ? "admin.coupon.deactivate" : "admin.coupon.delete", "Coupon", id);
  return ok({ deleted: !used });
});
