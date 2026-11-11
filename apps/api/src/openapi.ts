import { z } from "zod";
import { beneficiarySchema, openCurrencySchema } from "./accounts/schemas";
import { identitySchema, submitSchema } from "./kyc/schemas";
import { depositSchema, fxConvertSchema, fxQuoteSchema, internalTransferSchema, payoutSchema, requestCreateSchema, requestPaySchema, withdrawalSchema } from "./payments/schemas";
import {
  changePasswordSchema, loginSchema, mfaLoginSchema, refreshSchema, registerSchema, resendOtpSchema,
  resetConfirmSchema, resetRequestSchema, totpCodeSchema, verifyOtpSchema,
} from "./auth/schemas";

type Method = "get" | "post" | "put" | "delete";
interface Route {
  method: Method;
  path: string;
  summary: string;
  auth: boolean;
  body?: z.ZodType;
  responses: Record<string, string>;
}

const ERR = "Error response: { error: { code, message } }";

/** The HTTP surface of the customer API. The request schemas are the same zod objects the server validates with. */
export const ROUTES: Route[] = [
  { method: "get", path: "/kyc", summary: "Identity verification status: tier, what is still missing, masked identifiers and documents. Never decrypted values.", auth: true, responses: { "200": "Status.", "401": ERR } },
  { method: "put", path: "/kyc/identity", summary: "Save PAN or passport number, date of birth and nationality. Identifiers are encrypted at rest.", auth: true, body: identitySchema, responses: { "200": "Saved.", "401": ERR, "422": ERR } },
  { method: "post", path: "/kyc/documents", summary: "Upload a document as raw bytes. Content-Type must match the file: JPEG, PNG or PDF, 10 MB maximum. Scanned before storage.", auth: true, responses: { "201": "Stored.", "401": ERR, "422": ERR, "503": ERR } },
  { method: "post", path: "/kyc/submit", summary: "Submit for identity checking. Requires identity details and the required documents.", auth: true, body: submitSchema, responses: { "200": "Submitted.", "401": ERR, "422": ERR, "503": ERR } },
  { method: "post", path: "/kyc/webhook", summary: "Identity provider verdicts. Signed with HMAC-SHA256 over the raw body. Not for customers.", auth: false, responses: { "200": "Received.", "401": ERR, "503": ERR } },
  { method: "post", path: "/auth/register", summary: "Create an account. Sends verification codes to email and mobile.", auth: false, body: registerSchema, responses: { "202": "Accepted. Same response whether or not the details are already registered.", "422": ERR } },
  { method: "post", path: "/auth/otp/resend", summary: "Send a new verification code.", auth: false, body: resendOtpSchema, responses: { "202": "Accepted." } },
  { method: "post", path: "/auth/otp/verify", summary: "Verify the email or mobile code.", auth: false, body: verifyOtpSchema, responses: { "200": "Verified.", "400": ERR } },
  { method: "post", path: "/auth/login", summary: "Log in with email and password. Returns tokens, or an MFA challenge when 2FA is on.", auth: false, body: loginSchema, responses: { "200": "Tokens or mfa_required.", "401": ERR, "403": ERR, "429": ERR } },
  { method: "post", path: "/auth/login/mfa", summary: "Complete login with an authenticator or recovery code.", auth: false, body: mfaLoginSchema, responses: { "200": "Tokens.", "401": ERR } },
  { method: "post", path: "/auth/refresh", summary: "Rotate the refresh token and receive a new access token. Reuse ends the session.", auth: false, body: refreshSchema, responses: { "200": "New token pair.", "401": ERR } },
  { method: "post", path: "/auth/logout", summary: "End the current session.", auth: true, responses: { "200": "Signed out.", "401": ERR } },
  { method: "post", path: "/auth/password/reset/request", summary: "Request a password reset code. Same response for every email.", auth: false, body: resetRequestSchema, responses: { "202": "Accepted." } },
  { method: "post", path: "/auth/password/reset/confirm", summary: "Set a new password with the reset code. Ends all sessions.", auth: false, body: resetConfirmSchema, responses: { "200": "Password reset.", "400": ERR, "422": ERR } },
  { method: "post", path: "/auth/password/change", summary: "Change password. Other sessions are ended.", auth: true, body: changePasswordSchema, responses: { "200": "Changed.", "401": ERR, "422": ERR } },
  { method: "post", path: "/auth/2fa/totp/enroll", summary: "Start authenticator app setup. Returns the secret and an otpauth URI.", auth: true, responses: { "200": "Secret and URI.", "409": ERR } },
  { method: "post", path: "/auth/2fa/totp/confirm", summary: "Confirm setup with a code. Returns recovery codes once.", auth: true, body: totpCodeSchema, responses: { "200": "Recovery codes.", "401": ERR, "409": ERR } },
  { method: "post", path: "/auth/2fa/totp/disable", summary: "Turn off two-factor authentication with a current code.", auth: true, body: totpCodeSchema, responses: { "200": "Disabled.", "401": ERR, "409": ERR } },
  { method: "get", path: "/auth/devices", summary: "List devices signed in to the account.", auth: true, responses: { "200": "Devices.", "401": ERR } },
  { method: "delete", path: "/auth/devices/{id}", summary: "Sign out a device and end its sessions.", auth: true, responses: { "200": "Signed out.", "404": ERR } },
  { method: "get", path: "/me", summary: "Current customer profile and verification status.", auth: true, responses: { "200": "Profile.", "401": ERR } },
  { method: "get", path: "/accounts", summary: "Account reference and balances for each currency (available, pending, total).", auth: true, responses: { "200": "Account summary.", "401": ERR } },
  { method: "post", path: "/accounts/currencies", summary: "Open a currency account.", auth: true, body: openCurrencySchema, responses: { "200": "Opened or already open.", "401": ERR, "422": ERR } },
  { method: "get", path: "/dashboard", summary: "Home screen data: cash total, investment value (separate), totals and recent activity.", auth: true, responses: { "200": "Dashboard.", "401": ERR } },
  { method: "get", path: "/transactions", summary: "Recent transactions on spendable accounts.", auth: true, responses: { "200": "Transactions.", "401": ERR } },
  { method: "get", path: "/beneficiaries", summary: "Saved recipients, with masked destinations.", auth: true, responses: { "200": "Recipients.", "401": ERR } },
  { method: "post", path: "/beneficiaries", summary: "Save a recipient. The destination is stored encrypted.", auth: true, body: beneficiarySchema, responses: { "201": "Saved.", "401": ERR, "422": ERR } },
  { method: "delete", path: "/beneficiaries/{id}", summary: "Remove a saved recipient.", auth: true, responses: { "200": "Removed.", "404": ERR } },
  { method: "post", path: "/deposits", summary: "Start a deposit into the account. Credited only after the provider confirms.", auth: true, body: depositSchema, responses: { "201": "Payment started.", "422": ERR, "503": ERR } },
  { method: "post", path: "/transfers/internal", summary: "Send to another HK FinHub account. Posts immediately.", auth: true, body: internalTransferSchema, responses: { "201": "Sent.", "404": ERR, "422": ERR } },
  { method: "post", path: "/transfers", summary: "Send to a saved recipient. Reserves the amount until the provider confirms.", auth: true, body: payoutSchema, responses: { "201": "Submitted.", "422": ERR, "503": ERR } },
  { method: "post", path: "/transfers/withdrawals", summary: "Withdraw to the customer's own bank account.", auth: true, body: withdrawalSchema, responses: { "201": "Submitted.", "422": ERR, "503": ERR } },
  { method: "get", path: "/transfers", summary: "Recent transfers.", auth: true, responses: { "200": "Transfers.", "401": ERR } },
  { method: "get", path: "/transfers/{id}", summary: "One transfer and its status.", auth: true, responses: { "200": "Transfer.", "404": ERR } },
  { method: "post", path: "/fx/quotes", summary: "Quote a currency conversion. Rate and fee are locked for 30 seconds.", auth: true, body: fxQuoteSchema, responses: { "201": "Quote.", "410": ERR, "422": ERR } },
  { method: "post", path: "/fx/conversions", summary: "Convert using a quote. A quote can be used once.", auth: true, body: fxConvertSchema, responses: { "201": "Converted.", "409": ERR, "410": ERR, "422": ERR } },
  { method: "get", path: "/fx/history", summary: "Sample rate history for a pair (labelled sample).", auth: true, responses: { "200": "Points.", "422": ERR } },
  { method: "post", path: "/payment-requests", summary: "Create a payment request to share by link or QR code.", auth: true, body: requestCreateSchema, responses: { "201": "Request.", "422": ERR } },
  { method: "get", path: "/payment-requests", summary: "Your payment requests.", auth: true, responses: { "200": "Requests.", "401": ERR } },
  { method: "get", path: "/payment-requests/{ref}/public", summary: "What a payer sees: amount, memo and status. No account identifiers.", auth: false, responses: { "200": "Request.", "404": ERR } },
  { method: "post", path: "/payment-requests/{ref}/pay", summary: "Pay an open request. Credited to the requester once confirmed.", auth: true, body: requestPaySchema, responses: { "201": "Payment started.", "409": ERR, "422": ERR, "503": ERR } },
  { method: "post", path: "/payment-requests/{ref}/cancel", summary: "Cancel an open request you created.", auth: true, responses: { "200": "Cancelled.", "409": ERR } },
  { method: "post", path: "/webhooks/{provider}", summary: "Provider webhook. Verified against the raw body before any change.", auth: false, responses: { "200": "Received.", "400": ERR, "401": "Signature did not verify." } },
  { method: "get", path: "/config/currencies", summary: "Launch currencies.", auth: false, responses: { "200": "Currencies." } },
  { method: "get", path: "/health", summary: "Liveness.", auth: false, responses: { "200": "Process is up." } },
  { method: "get", path: "/ready", summary: "Readiness: Postgres and Redis respond.", auth: false, responses: { "200": "Ready.", "503": "A dependency is down." } },
];

function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown> & { $schema?: string };
  return rest;
}

/** OpenAPI 3.1 document, built from the routes table above. Test: every route is mounted (see apps/api/test). */
export function buildOpenApi(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of ROUTES) {
    const op: Record<string, unknown> = {
      summary: r.summary,
      responses: Object.fromEntries(Object.entries(r.responses).map(([code, desc]) => [code, { description: desc }])),
    };
    if (r.auth) op["security"] = [{ bearerAuth: [] }];
    if (r.body) op["requestBody"] = { required: true, content: { "application/json": { schema: jsonSchema(r.body) } } };
    if (r.method === "delete" && r.path.includes("{id}")) op["parameters"] = [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }];
    (paths[`/v1${r.path}`] ??= {})[r.method] = op;
  }
  return {
    openapi: "3.1.0",
    info: { title: "HK FinHub customer API", version: "0.1.0", description: "Sandbox preview. Live money movement is not yet enabled." },
    servers: [{ url: "/" }],
    components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
    paths,
  };
}
