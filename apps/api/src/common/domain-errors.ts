import { HttpException, HttpStatus } from "@nestjs/common";
import { AccountError } from "@hkfinhub/accounts";
import { FxError } from "@hkfinhub/fx";
import { LedgerError } from "@hkfinhub/ledger";
import { PaymentError, WebhookSignatureError } from "@hkfinhub/payments";
import { TransferError } from "@hkfinhub/transfers";

const LEDGER: Record<string, number> = {
  INSUFFICIENT_FUNDS: 422, UNBALANCED: 500, IDEMPOTENCY_CONFLICT: 409, ALREADY_REVERSED: 409, INVALID_REQUEST: 422,
  CURRENCY_MISMATCH: 422, ACCOUNT_NOT_FOUND: 404, TRANSACTION_NOT_FOUND: 404, SELF_APPROVAL: 403, APPROVAL_NOT_PENDING: 409,
};

const FX: Record<string, number> = {
  INVALID_REQUEST: 422, CURRENCY_NOT_SUPPORTED: 422, QUOTE_NOT_FOUND: 404, QUOTE_EXPIRED: 410, QUOTE_ALREADY_USED: 409, INSUFFICIENT_FUNDS: 422,
};

const TRANSFER: Record<string, number> = {
  INVALID_REQUEST: 422, NOT_FOUND: 404, INSUFFICIENT_FUNDS: 422, CURRENCY_MISMATCH: 422, NOT_AVAILABLE: 503, REQUEST_NOT_OPEN: 409,
};

const PAYMENT: Record<string, number> = {
  NOT_AVAILABLE: 503, ROUTE_NOT_ENABLED: 503, UNKNOWN_PROVIDER: 503, PAYMENT_NOT_FOUND: 404, IDEMPOTENCY_CONFLICT: 409, PROVIDER_ERROR: 502, INVALID_REQUEST: 422,
};

/**
 * Maps domain errors to HTTP errors with stable codes. Customer messages stay generic where the internal
 * reason would reveal something (for example provider names or account existence).
 */
export function mapDomainError(err: unknown): never {
  if (err instanceof LedgerError) throw new HttpException({ code: err.code, message: err.message }, LEDGER[err.code] ?? 422);
  if (err instanceof FxError) throw new HttpException({ code: err.code, message: err.message }, FX[err.code] ?? 422);
  if (err instanceof TransferError) throw new HttpException({ code: err.code, message: err.message }, TRANSFER[err.code] ?? 422);
  if (err instanceof PaymentError) {
    const code = err.code === "UNKNOWN_PROVIDER" || err.code === "ROUTE_NOT_ENABLED" ? "NOT_AVAILABLE" : err.code;
    const message = code === "NOT_AVAILABLE" ? "This payment method is not yet available." : err.code === "PROVIDER_ERROR" ? "The payment provider could not complete this request. Please try again." : err.message;
    throw new HttpException({ code, message }, PAYMENT[err.code] ?? 422);
  }
  if (err instanceof AccountError) throw new HttpException({ code: err.code, message: err.message }, err.code === "NOT_FOUND" ? HttpStatus.NOT_FOUND : HttpStatus.UNPROCESSABLE_ENTITY);
  if (err instanceof WebhookSignatureError) throw new HttpException({ code: "INVALID_SIGNATURE", message: "Webhook signature check failed." }, HttpStatus.UNAUTHORIZED);
  throw err;
}
