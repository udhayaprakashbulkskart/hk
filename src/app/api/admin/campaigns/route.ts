import { handler, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { campaignSchema } from "@/lib/validation";
import { campaignData } from "@/lib/services/promotions";
import { audit } from "@/lib/audit";

export const POST = handler(async (req) => {
  const admin = await requireRole("ADMIN");
  const input = await parseBody(req, campaignSchema);
  const c = await db.campaign.create({ data: { ...campaignData(input), name: input.name, title: input.title } });
  await audit(admin.id, "admin.campaign.create", "Campaign", c.id, { name: c.name });
  return ok({ id: c.id }, 201);
});
