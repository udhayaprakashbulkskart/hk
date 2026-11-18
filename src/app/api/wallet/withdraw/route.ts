import { handler, ok, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { badRequest, forbidden } from "@/lib/errors";
import { toPaise } from "@/lib/money";
import { MIN_WITHDRAWAL_PAISE } from "@/lib/constants";
import { requestWithdrawal } from "@/lib/services/orders";
import { withdrawalSchema } from "@/lib/validation";

export const POST = handler(async (req) => {
  const user = await requireUser();
  if (user.seller?.status !== "VERIFIED") throw forbidden("Only verified sellers can withdraw earnings");
  const input = await parseBody(req, withdrawalSchema);
  const amount = toPaise(input.amount);
  if (amount < MIN_WITHDRAWAL_PAISE) throw badRequest("Minimum withdrawal is ₹100", { amount: "Minimum ₹100" });
  const w = await requestWithdrawal(user.id, amount, input.upiId);
  return ok({ id: w.id }, 201);
});
