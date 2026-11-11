export class AccountError extends Error {
  constructor(readonly code: "NOT_FOUND" | "INVALID_REQUEST" | "CURRENCY_NOT_OPEN" | "CURRENCY_ALREADY_OPEN" | "ACCOUNT_NOT_OPEN", message: string) {
    super(message);
    this.name = "AccountError";
  }
}
