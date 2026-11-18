import { handler, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { SETTING_KEYS, getAutoCompleteDays, getCommissionBps, setSetting } from "@/lib/settings";
import { commissionSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

export const GET = handler(async () => {
  await requireRole("ADMIN");
  return ok({ commissionPercent: (await getCommissionBps()) / 100, autoCompleteDays: await getAutoCompleteDays() });
});

export const PUT = handler(async (req) => {
  const admin = await requireRole("ADMIN");
  const input = await parseBody(req, commissionSchema);
  const before = { commissionBps: await getCommissionBps(), autoCompleteDays: await getAutoCompleteDays() };
  await setSetting(SETTING_KEYS.commissionBps, Math.round(input.commissionPercent * 100));
  await setSetting(SETTING_KEYS.autoCompleteDays, input.autoCompleteDays);
  await audit(admin.id, "admin.settings.update", "Setting", null, { before, after: input });
  return ok({});
});
