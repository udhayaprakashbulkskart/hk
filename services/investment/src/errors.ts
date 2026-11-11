export type InvestmentErrorCode =
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "KYC_REQUIRED"
  | "INSUFFICIENT_FUNDS"
  | "NOT_AVAILABLE"
  | "INVALID_TRANSITION";

export class InvestmentError extends Error {
  constructor(readonly code: InvestmentErrorCode, message: string) {
    super(message);
    this.name = "InvestmentError";
  }
}
