import { handler, ok, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { conflict, notFound } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { reportSchema } from "@/lib/validation";

export const POST = handler(async (req) => {
  const user = await requireUser();
  await rateLimit(`report:${user.id}`, 10, 3600);
  const input = await parseBody(req, reportSchema);
  const product = await db.product.findUnique({ where: { id: input.productId }, select: { id: true } });
  if (!product) throw notFound("Product not found");
  const dup = await db.report.findFirst({ where: { productId: input.productId, reporterId: user.id, status: "OPEN" } });
  if (dup) throw conflict("You've already reported this listing — our team is reviewing it");
  await db.report.create({ data: { productId: input.productId, reporterId: user.id, reason: input.reason, details: input.details } });
  return ok({}, 201);
});
