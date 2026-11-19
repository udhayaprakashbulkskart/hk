import { handler, ok, parsePatch } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { campaignSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";
import { campaignData } from "@/lib/services/promotions";

export const PATCH = handler<{ id: string }>(async (req, { id }) => {
  const admin = await requireRole("ADMIN");
  const input = await parsePatch(req, campaignSchema.partial());
  await db.campaign.update({ where: { id }, data: campaignData(input) });
  await audit(admin.id, "admin.campaign.update", "Campaign", id);
  return ok({});
});

export const DELETE = handler<{ id: string }>(async (_req, { id }) => {
  const admin = await requireRole("ADMIN");
  await db.campaign.delete({ where: { id } });
  await audit(admin.id, "admin.campaign.delete", "Campaign", id);
  return ok({});
});
