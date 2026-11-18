import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { decideWithdrawal } from "@/lib/services/orders";

const schema = z.object({
  action: z.enum(["approve", "paid", "reject"]),
  note: z.string().trim().max(300).optional(),
  payoutRef: z.string().trim().max(64).optional(),
});

export const PATCH = handler<{ id: string }>(async (req, { id }) => {
  const admin = await requireRole("ADMIN");
  const { action, note, payoutRef } = await parseBody(req, schema);
  await decideWithdrawal(admin.id, id, action, note, payoutRef);
  return ok({});
});
