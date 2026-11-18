import "server-only";
import type { Tx } from "./db";
import { ApiError } from "./errors";
import type { WalletTxnReason } from "@/generated/prisma/enums";

/**
 * Wallet ledger. Every balance change writes a WalletTransaction row with the resulting
 * balance, inside the caller's DB transaction. Debits are conditional so the balance
 * can never go negative, even under concurrent requests.
 */
export async function creditWallet(tx: Tx, userId: string, amount: number, reason: WalletTxnReason, reference?: string, note?: string) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("credit amount must be a positive integer");
  const user = await tx.user.update({ where: { id: userId }, data: { walletBalance: { increment: amount } }, select: { walletBalance: true } });
  return tx.walletTransaction.create({
    data: { userId, type: "CREDIT", reason, amount, balanceAfter: user.walletBalance, reference, note },
  });
}

export async function debitWallet(tx: Tx, userId: string, amount: number, reason: WalletTxnReason, reference?: string, note?: string) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("debit amount must be a positive integer");
  const res = await tx.user.updateMany({
    where: { id: userId, walletBalance: { gte: amount } },
    data: { walletBalance: { decrement: amount } },
  });
  if (res.count !== 1) throw new ApiError(402, "Insufficient wallet balance");
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { walletBalance: true } });
  return tx.walletTransaction.create({
    data: { userId, type: "DEBIT", reason, amount, balanceAfter: user.walletBalance, reference, note },
  });
}
