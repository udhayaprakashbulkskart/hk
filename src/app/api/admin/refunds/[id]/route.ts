import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { decideRefund } from "@/lib/services/orders";

const schema = z.object({ approve: z.boolean(), note: z.string().trim().max(300).optional() });

export const PATCH = handler<{ id: string }>(async (req, { id }) => {
  const admin = await requireRole("ADMIN");
  const { approve, note } = await parseBody(req, schema);
  await decideRefund(admin.id, id, approve, note);
  return ok({});
});
