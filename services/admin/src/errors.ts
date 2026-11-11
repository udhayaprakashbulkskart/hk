export type AdminErrorCode =
  | "FORBIDDEN"
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "SELF_APPROVAL"
  | "APPROVAL_NOT_PENDING"
  | "NOT_AVAILABLE";

export class AdminError extends Error {
  constructor(readonly code: AdminErrorCode, message: string) {
    super(message);
    this.name = "AdminError";
  }
}
