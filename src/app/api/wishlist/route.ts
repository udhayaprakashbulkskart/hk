import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";

/** Toggles a product in the wishlist. */
export const POST = handler(async (req) => {
  const user = await requireUser();
  const { productId } = await parseBody(req, z.object({ productId: z.string().min(1) }));
  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw notFound("Product not found");
  const existing = await db.wishlistItem.findUnique({ where: { userId_productId: { userId: user.id, productId } } });
  if (existing) {
    await db.$transaction([
      db.wishlistItem.delete({ where: { userId_productId: { userId: user.id, productId } } }),
      db.product.update({ where: { id: productId }, data: { wishlistCount: { decrement: 1 } } }),
    ]);
    return ok({ saved: false });
  }
  await db.$transaction([
    db.wishlistItem.create({ data: { userId: user.id, productId } }),
    db.product.update({ where: { id: productId }, data: { wishlistCount: { increment: 1 } } }),
  ]);
  return ok({ saved: true });
});
