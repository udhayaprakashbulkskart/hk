import { KycError } from "./errors";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** PAN: five letters, four digits, one letter. Format only; verification is a provider call. */
export function isPan(value: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value);
}

export function isPassportNumber(value: string): boolean {
  return /^[A-Z0-9]{6,9}$/.test(value);
}

/** Age in whole years on the given date. Customers must be 18 or over. */
export function ageOn(dob: Date, on: Date): number {
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const m = on.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

/** Checks that the bytes really are the claimed type, by their leading signature, not the client's label. */
export function sniffMime(body: Buffer): string | null {
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return "image/jpeg";
  if (body.length >= 8 && body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (body.length >= 4 && body.subarray(0, 4).toString("latin1") === "%PDF") return "application/pdf";
  return null;
}

export function validateDocument(body: Buffer, declaredMime: string): string {
  if (body.length === 0) throw new KycError("FILE_REJECTED", "the file is empty");
  if (body.length > MAX_DOCUMENT_BYTES) throw new KycError("FILE_REJECTED", "files must be 10 MB or smaller");
  const actual = sniffMime(body);
  if (!actual) throw new KycError("FILE_REJECTED", "upload a JPEG, PNG or PDF");
  if (declaredMime !== actual) throw new KycError("FILE_REJECTED", "the file type does not match its contents");
  return actual;
}
