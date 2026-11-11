export type LedgerErrorCode =
  | "INSUFFICIENT_FUNDS"
  | "UNBALANCED"
  | "IDEMPOTENCY_CONFLICT"
  | "ALREADY_REVERSED"
  | "INVALID_REQUEST"
  | "CURRENCY_MISMATCH"
  | "ACCOUNT_NOT_FOUND"
  | "TRANSACTION_NOT_FOUND"
  | "SELF_APPROVAL"
  | "APPROVAL_NOT_PENDING";

export class LedgerError extends Error {
  constructor(readonly code: LedgerErrorCode, message: string) {
    super(message);
    this.name = "LedgerError";
  }
}

/** Raised by the store when a unique key collides. The service decides whether that is a replay. */
export class DuplicateKeyError extends Error {
  constructor(readonly target: "idempotencyKey" | "reversesId") {
    super(`duplicate ${target}`);
    this.name = "DuplicateKeyError";
  }
}

/** Raised by the store when the database rejects a balance change that would overdraw an account. */
export class InsufficientFundsError extends Error {
  constructor() {
    super("insufficient funds");
    this.name = "InsufficientFundsError";
  }
}
