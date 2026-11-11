export type KycErrorCode =
  | "INVALID_REQUEST"
  | "NOT_FOUND"
  | "INVALID_TRANSITION"
  | "FILE_REJECTED"
  | "MALWARE_DETECTED"
  | "FORBIDDEN"
  | "INCOMPLETE"
  | "INTEGRITY_FAILURE"
  | "NOT_AVAILABLE";

export class KycError extends Error {
  constructor(readonly code: KycErrorCode, message: string) {
    super(message);
    this.name = "KycError";
  }
}
