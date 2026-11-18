import { handler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { completeItem } from "@/lib/services/orders";

export const POST = handler<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser();
  await completeItem(id, { id: user.id, isAdmin: user.role === "ADMIN" });
  return ok({});
});
