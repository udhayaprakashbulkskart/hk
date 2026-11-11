export type TransferKind = "INTERNAL" | "TRANSFER" | "WITHDRAWAL";
export type TransferStatus = "INITIATED" | "SUBMITTED" | "POSTED" | "FAILED";

export interface TransferRecord {
  id: string;
  accountId: string;
  kind: TransferKind;
  status: TransferStatus;
  sourceCurrency: string;
  /** Total debited from the customer, in the source currency, fee included. Reserved until settled. */
  sourceMinor: bigint;
  feeMinor: bigint;
  recipientCurrency: string;
  recipientMinor: bigint;
  fxQuoteId: string | null;
  recipientAccountId: string | null;
  destinationMasked: string | null;
  method: string | null;
  country: string | null;
  paymentId: string | null;
  ledgerTransactionId: string | null;
  failureReason: string | null;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewTransfer extends Omit<TransferRecord, "status" | "paymentId" | "ledgerTransactionId" | "failureReason" | "createdAt" | "updatedAt"> {
  now: Date;
}

export interface TransferStore {
  transaction<T>(fn: (tx: TransferStore) => Promise<T>): Promise<T>;
  /** Holds a per-account lock for the enclosing transaction. Every spending path takes it. */
  lockAccounts(accountIds: string[]): Promise<void>;
  findByKey(key: string): Promise<TransferRecord | null>;
  findById(id: string): Promise<TransferRecord | null>;
  findByPaymentId(paymentId: string): Promise<TransferRecord | null>;
  listForAccount(accountId: string, limit: number): Promise<TransferRecord[]>;
  insert(t: NewTransfer): Promise<TransferRecord>;
  setPaymentId(id: string, paymentId: string, now: Date): Promise<void>;
  /** Compare-and-set on status. */
  move(id: string, from: TransferStatus[], to: TransferStatus, now: Date, extra?: { failureReason?: string; ledgerTransactionId?: string }): Promise<boolean>;
  /** Sum of source amounts still reserved (INITIATED or SUBMITTED) for an account and currency. */
  reservedMinor(accountId: string, currency: string): Promise<bigint>;
}

export type RequestStatus = "OPEN" | "PAID" | "CANCELLED";

export interface PaymentRequestRecord {
  ref: string;
  accountId: string;
  currency: string;
  amountMinor: bigint | null;
  memo: string;
  status: RequestStatus;
  paymentId: string | null;
  createdAt: Date;
  paidAt: Date | null;
}

export interface RequestStore {
  insert(r: Omit<PaymentRequestRecord, "status" | "paymentId" | "paidAt">): Promise<PaymentRequestRecord>;
  findByRef(ref: string): Promise<PaymentRequestRecord | null>;
  listForAccount(accountId: string, limit: number): Promise<PaymentRequestRecord[]>;
  cancel(ref: string, accountId: string): Promise<boolean>;
  /** Marks an open request as paid by a confirmed payment. Returns false if it was not open. */
  markPaid(ref: string, paymentId: string, now: Date): Promise<boolean>;
}

/** Compliance gate, called inside the account-locked section before any funds are reserved. */
export interface OutboundGuard {
  assertOutbound(input: { userId: string; accountId: string; beneficiaryId: string | null; corridor: string; currency: string; amountMinor: bigint }): Promise<void>;
}
