import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { moderateListing } from "@/lib/services/products";

const schema = z.object({ action: z.enum(["approve", "reject", "feature", "unfeature"]), reason: z.string().trim().max(300).optional() });

export const PATCH = handler<{ id: string }>(async (req, { id }) => {
  const admin = await requireRole("ADMIN");
  const { action, reason } = await parseBody(req, schema);
  await moderateListing(admin.id, id, action, reason);
  return ok({});
});
