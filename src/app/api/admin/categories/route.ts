import { handler, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { conflict } from "@/lib/errors";
import { categorySchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

export const POST = handler(async (req) => {
  const admin = await requireRole("ADMIN");
  const input = await parseBody(req, categorySchema);
  if (await db.category.findUnique({ where: { slug: input.slug } })) throw conflict("That slug is already used");
  const c = await db.category.create({ data: { ...input, description: input.description || null } });
  await audit(admin.id, "admin.category.create", "Category", c.id, { slug: c.slug });
  return ok({ id: c.id }, 201);
});
