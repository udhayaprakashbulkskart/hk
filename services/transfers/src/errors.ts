export type TransferErrorCode =
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "INSUFFICIENT_FUNDS"
  | "CURRENCY_MISMATCH"
  | "NOT_AVAILABLE"
  | "REQUEST_NOT_OPEN";

export class TransferError extends Error {
  constructor(readonly code: TransferErrorCode, message: string) {
    super(message);
    this.name = "TransferError";
  }
}
