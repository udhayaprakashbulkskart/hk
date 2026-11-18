import { handler, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { bannerSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

export const POST = handler(async (req) => {
  const admin = await requireRole("ADMIN");
  const input = await parseBody(req, bannerSchema);
  const b = await db.banner.create({ data: input });
  await audit(admin.id, "admin.banner.create", "Banner", b.id);
  return ok({ id: b.id }, 201);
});
