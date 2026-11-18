import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { badRequest, notFound } from "@/lib/errors";

export const GET = handler(async () => {
  const user = await requireUser();
  const items = await db.cartItem.findMany({ where: { userId: user.id }, select: { productId: true, quantity: true } });
  return ok({ items, count: items.reduce((s, i) => s + i.quantity, 0) });
});

/** Sets the quantity of a product in the cart (adds it if missing). */
export const POST = handler(async (req) => {
  const user = await requireUser();
  const { productId, quantity } = await parseBody(req, z.object({ productId: z.string().min(1), quantity: z.coerce.number().int().min(1).max(10).default(1) }));
  const p = await db.product.findUnique({ where: { id: productId }, select: { status: true, stock: true, sellerId: true } });
  if (!p || p.status !== "APPROVED") throw notFound("This item is not available");
  if (p.sellerId === user.id) throw badRequest("You can't buy your own listing");
  if (p.stock < quantity) throw badRequest(`Only ${p.stock} left in stock`);
  await db.cartItem.upsert({
    where: { userId_productId: { userId: user.id, productId } },
    update: { quantity },
    create: { userId: user.id, productId, quantity },
  });
  const count = await db.cartItem.aggregate({ where: { userId: user.id }, _sum: { quantity: true } });
  return ok({ count: count._sum.quantity ?? 0 });
});

export const DELETE = handler(async (req) => {
  const user = await requireUser();
  const productId = new URL(req.url).searchParams.get("productId");
  if (productId) await db.cartItem.deleteMany({ where: { userId: user.id, productId } });
  else await db.cartItem.deleteMany({ where: { userId: user.id } });
  return ok({});
});
