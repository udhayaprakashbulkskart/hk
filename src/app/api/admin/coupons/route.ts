import { handler, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { conflict } from "@/lib/errors";
import { couponSchema } from "@/lib/validation";
import { couponData } from "@/lib/services/promotions";
import { audit } from "@/lib/audit";

export const POST = handler(async (req) => {
  const admin = await requireRole("ADMIN");
  const data = couponData(await parseBody(req, couponSchema));
  if (await db.coupon.findUnique({ where: { code: data.code } })) throw conflict("A coupon with this code already exists");
  const c = await db.coupon.create({ data });
  await audit(admin.id, "admin.coupon.create", "Coupon", c.id, { code: c.code });
  return ok({ id: c.id }, 201);
});
