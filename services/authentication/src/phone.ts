import { parsePhoneNumberFromString } from "libphonenumber-js";
import { AuthError } from "./errors";

/** Normalises a user-entered phone number to E.164 and rejects anything that is not a valid number. */
export function normalisePhone(input: string, defaultCountry?: "HK" | "IN" | "SG" | "US" | "GB" | "AE" | "CN" | "DE" | "FR" | "AU"): string {
  const parsed = parsePhoneNumberFromString(input.trim(), defaultCountry);
  if (!parsed || !parsed.isValid()) {
    throw new AuthError("PHONE_INVALID", "Enter a valid mobile number in international format, for example +852 5555 0123.");
  }
  return parsed.number;
}

export function normaliseEmail(input: string): string {
  return input.trim().toLowerCase();
}
