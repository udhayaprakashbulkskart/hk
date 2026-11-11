import { LedgerError } from "./errors";
import type { LedgerStore } from "./ports";
import type { LedgerService } from "./service";

export interface AdjustmentPayload {
  customerAccountId: string;
  currency: string;
  amountMinor: string;
  direction: "CREDIT" | "DEBIT";
  counterAccountId: string;
  reason: string;
}

/**
 * Maker-checker for balance adjustments. A request records intent only and changes no balance.
 * A different person must approve it before any entry is posted. Self-approval is refused.
 */
export class AdjustmentWorkflow {
  constructor(
    private readonly store: LedgerStore,
    private readonly ledger: LedgerService,
    private readonly newId: () => string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async request(makerId: string, payload: AdjustmentPayload): Promise<string> {
    if (BigInt(payload.amountMinor) <= 0n) throw new LedgerError("INVALID_REQUEST", "adjustment amount must be positive");
    if (payload.reason.trim().length < 10) throw new LedgerError("INVALID_REQUEST", "give a reason of at least 10 characters");
    const id = this.newId();
    await this.store.createApproval({ id, action: "BALANCE_ADJUSTMENT", payload: { ...payload }, requestedBy: makerId });
    return id;
  }

  async approve(checkerId: string, approvalId: string): Promise<{ transactionId: string }> {
    const req = await this.store.findApproval(approvalId);
    if (!req) throw new LedgerError("INVALID_REQUEST", "approval request not found");
    if (req.status !== "PENDING") throw new LedgerError("APPROVAL_NOT_PENDING", "this request is no longer pending");
    if (req.requestedBy === checkerId) throw new LedgerError("SELF_APPROVAL", "the person who requested a change cannot approve it");

    const p = req.payload as unknown as AdjustmentPayload;
    const amount = BigInt(p.amountMinor);
    const customer = p.direction === "CREDIT" ? { accountId: p.customerAccountId, side: "CREDIT" as const } : { accountId: p.customerAccountId, side: "DEBIT" as const };
    const counter = { accountId: p.counterAccountId, side: customer.side === "CREDIT" ? ("DEBIT" as const) : ("CREDIT" as const) };
    const result = await this.ledger.post({
      kind: "ADJUSTMENT",
      idempotencyKey: `approval-${approvalId}`,
      description: `Approved adjustment: ${p.reason}`,
      reference: approvalId,
      createdBy: checkerId,
      entries: [
        { accountId: customer.accountId, side: customer.side, amountMinor: amount, currency: p.currency },
        { accountId: counter.accountId, side: counter.side, amountMinor: amount, currency: p.currency },
      ],
    });
    await this.store.decideApproval(approvalId, "APPROVED", checkerId, this.now());
    return { transactionId: result.transaction.id };
  }
}
