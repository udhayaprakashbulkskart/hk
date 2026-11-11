import type { LaunchCurrency } from "@hkfinhub/shared";

export type Direction = "COLLECTION" | "PAYOUT";
export type Environment = "test" | "live";
export type ProviderId =
  | "razorpay" | "razorpayx" | "stripe" | "adyen"
  | "upi_bank_partner" | "intl_payout_partner" | "ppi_partner";
export type ProviderStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
export type PaymentMethod = "upi" | "bank" | "card" | "swift";
export type PaymentStatus = "CREATED" | "PENDING" | "SUBMITTED" | "SUCCEEDED" | "FAILED" | "REFUNDED";

/** The only network capability adapters have. Tests substitute a fake; production uses fetch. */
export interface HttpTransport {
  request(req: { method: "GET" | "POST"; url: string; headers: Record<string, string>; body?: string }): Promise<{ status: number; body: string }>;
}

export type Headers = Record<string, string | undefined>;

export interface CollectionRequest {
  reference: string;
  amountMinor: bigint;
  currency: LaunchCurrency;
  description: string;
  metadata: Record<string, string>;
}

export interface PayoutRequest {
  reference: string;
  amountMinor: bigint;
  currency: LaunchCurrency;
  description: string;
  beneficiary: { name: string; country: string; method: "upi" | "bank" | "swift"; destination: string };
}

export interface WebhookEvent {
  eventId: string;
  type: string;
  kind: "COLLECTION" | "PAYOUT";
  providerRef: string;
}

/** Each provider implements this. Adapters never touch the database and never move money. */
export interface ProviderAdapter {
  readonly id: ProviderId;
  readonly environment: Environment;
  /** clientSecret is returned to the customer app only. It is never stored. */
  createCollection(req: CollectionRequest): Promise<{ providerRef: string; checkoutUrl?: string; instructions?: string; clientSecret?: string }>;
  createPayout(req: PayoutRequest): Promise<{ providerRef: string }>;
  /** Authoritative status, fetched from the provider. Webhook payloads are never trusted on their own. */
  fetchStatus(kind: "COLLECTION" | "PAYOUT", providerRef: string): Promise<{ status: ProviderStatus }>;
  /** Throws WebhookSignatureError unless the raw body is authentic. */
  verifyWebhook(rawBody: Buffer, headers: Headers, now: Date): void;
  parseWebhook(rawBody: Buffer, headers: Headers): WebhookEvent[];
}

export interface PaymentRecord {
  id: string;
  direction: Direction;
  providerId: ProviderId;
  environment: Environment;
  providerRef: string | null;
  reference: string;
  idempotencyKey: string;
  accountId: string;
  currency: string;
  amountMinor: bigint;
  method: PaymentMethod;
  country: string;
  status: PaymentStatus;
  ledgerTransactionId: string | null;
  transferId: string | null;
  metadata: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewPayment {
  direction: Direction;
  providerId: ProviderId;
  environment: Environment;
  reference: string;
  idempotencyKey: string;
  accountId: string;
  currency: string;
  amountMinor: bigint;
  method: PaymentMethod;
  country: string;
  transferId: string | null;
  metadata: Record<string, string>;
  now: Date;
}

export interface WebhookRecord {
  id: string;
  providerId: ProviderId;
  eventId: string;
  type: string;
  processedAt: Date | null;
  outcome: string | null;
}

export interface PaymentStore {
  transaction<T>(fn: (tx: PaymentStore) => Promise<T>): Promise<T>;
  findByIdempotencyKey(key: string): Promise<PaymentRecord | null>;
  /** Throws DuplicateKeyError when the idempotency key or reference is taken. */
  insertPayment(p: NewPayment): Promise<PaymentRecord>;
  findPayment(id: string): Promise<PaymentRecord | null>;
  findByProviderRef(providerId: ProviderId, providerRef: string): Promise<PaymentRecord | null>;
  setProviderRef(id: string, providerRef: string, status: PaymentStatus, now: Date): Promise<void>;
  /** Compare-and-set on status. Returns false if the payment was not in `from`. */
  moveStatus(id: string, from: PaymentStatus[], to: PaymentStatus, now: Date, failureReason?: string): Promise<boolean>;
  setLedgerTransaction(id: string, ledgerTransactionId: string, now: Date): Promise<void>;
  /** Records a webhook once. Returns the existing row when the event was seen before. */
  upsertWebhook(input: { providerId: ProviderId; eventId: string; type: string; payload: unknown; now: Date }): Promise<{ record: WebhookRecord; created: boolean }>;
  markWebhookProcessed(id: string, outcome: string, now: Date): Promise<void>;
  /** Routes that are enabled for this direction, country, currency and method, in this environment. */
  findRoutes(q: { direction: Direction; country: string; currency: string; method: PaymentMethod; environment: Environment }): Promise<{ providerId: ProviderId }[]>;
  hasProviderApproval(providerId: ProviderId, environment: Environment): Promise<boolean>;
}

/** Called by the payments service when money-relevant status is confirmed. Implemented by transfers and receive requests. */
export interface PaymentListener {
  onPayoutSucceeded(payment: PaymentRecord): Promise<void>;
  onPayoutFailed(payment: PaymentRecord, reason: string): Promise<void>;
  onCollectionSucceeded?(payment: PaymentRecord): Promise<void>;
}
