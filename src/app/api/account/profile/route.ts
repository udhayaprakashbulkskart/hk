import { handler, ok, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { profileSchema } from "@/lib/validation";

export const PATCH = handler(async (req) => {
  const user = await requireUser();
  const input = await parseBody(req, profileSchema);
  await db.user.update({
    where: { id: user.id },
    data: { name: input.name, phone: input.phone || null, gamePlayerId: input.gamePlayerId || null, preferredGame: input.preferredGame },
  });
  return ok({});
});
