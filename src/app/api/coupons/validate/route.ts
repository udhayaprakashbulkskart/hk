import { handler, ok, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { badRequest } from "@/lib/errors";
import { evaluateCoupon } from "@/lib/services/coupons";
import { couponPreviewSchema } from "@/lib/validation";

/** Previews a coupon against the buyer's cart (or a single Buy-Now product). Nothing is reserved here. */
export const POST = handler(async (req) => {
  const user = await requireUser();
  const { code, productId, quantity } = await parseBody(req, couponPreviewSchema);
  let subtotal = 0;
  if (productId) {
    const p = await db.product.findUnique({ where: { id: productId }, select: { price: true, status: true } });
    if (!p || p.status !== "APPROVED") throw badRequest("Item unavailable");
    subtotal = p.price * (quantity ?? 1);
  } else {
    const cart = await db.cartItem.findMany({ where: { userId: user.id }, include: { product: { select: { price: true } } } });
    subtotal = cart.reduce((s, c) => s + c.product.price * c.quantity, 0);
  }
  if (!subtotal) throw badRequest("Your cart is empty");
  const { coupon, discount } = await evaluateCoupon(db, code, user.id, subtotal);
  return ok({ code: coupon.code, description: coupon.description, discount, subtotal, total: subtotal - discount });
});
