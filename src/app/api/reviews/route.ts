import { handler, ok, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { leaveReview } from "@/lib/services/orders";
import { reviewSchema } from "@/lib/validation";

export const POST = handler(async (req) => {
  const user = await requireUser();
  const input = await parseBody(req, reviewSchema);
  await leaveReview(user.id, input.orderItemId, input.rating, input.comment);
  return ok({}, 201);
});
