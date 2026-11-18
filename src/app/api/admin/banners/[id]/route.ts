import { handler, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { bannerSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

export const PATCH = handler<{ id: string }>(async (req, { id }) => {
  const admin = await requireRole("ADMIN");
  const input = await parseBody(req, bannerSchema.partial());
  await db.banner.update({ where: { id }, data: input });
  await audit(admin.id, "admin.banner.update", "Banner", id, input);
  return ok({});
});

export const DELETE = handler<{ id: string }>(async (_req, { id }) => {
  const admin = await requireRole("ADMIN");
  await db.banner.delete({ where: { id } });
  await audit(admin.id, "admin.banner.delete", "Banner", id);
  return ok({});
});
