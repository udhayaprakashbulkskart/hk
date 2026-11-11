export type ComplianceErrorCode =
  | "KYC_REQUIRED"
  | "COMPLIANCE_HOLD"
  | "LIMIT_EXCEEDED"
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_TRANSITION"
  | "NOT_AVAILABLE";

export class ComplianceError extends Error {
  constructor(
    readonly code: ComplianceErrorCode,
    message: string,
    readonly details?: Record<string, string | number | null>,
  ) {
    super(message);
    this.name = "ComplianceError";
  }
}
