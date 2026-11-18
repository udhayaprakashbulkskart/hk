import { handler, ok, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { requestRefund } from "@/lib/services/orders";
import { refundRequestSchema } from "@/lib/validation";

export const POST = handler(async (req) => {
  const user = await requireUser();
  const input = await parseBody(req, refundRequestSchema);
  const r = await requestRefund(user.id, input.orderItemId, input.reason);
  return ok({ id: r.id }, 201);
});
