import { z } from "zod";
import { handler, ok, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { markDelivered } from "@/lib/services/orders";

const schema = z.object({
  deliveryNote: z.string().trim().min(5, "Add a short delivery note (e.g. gift sent at 18:40, or the redeem code)").max(500),
});

export const POST = handler<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const { deliveryNote } = await parseBody(req, schema);
  await markDelivered(user.id, id, deliveryNote, user.role === "ADMIN");
  return ok({});
});
