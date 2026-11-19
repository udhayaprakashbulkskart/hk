import { handler, ok, parsePatch } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { conflict } from "@/lib/errors";
import { categorySchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

export const PATCH = handler<{ id: string }>(async (req, { id }) => {
  const admin = await requireRole("ADMIN");
  const input = await parsePatch(req, categorySchema.partial());
  await db.category.update({ where: { id }, data: input });
  await audit(admin.id, "admin.category.update", "Category", id, input);
  return ok({});
});

export const DELETE = handler<{ id: string }>(async (_req, { id }) => {
  const admin = await requireRole("ADMIN");
  const n = await db.product.count({ where: { categoryId: id } });
  if (n) throw conflict(`Move or archive the ${n} product(s) in this category first`);
  await db.category.delete({ where: { id } });
  await audit(admin.id, "admin.category.delete", "Category", id);
  return ok({});
});
