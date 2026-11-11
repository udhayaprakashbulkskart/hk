export type OrderStatus = "PLACED" | "PARTIALLY_FILLED" | "FILLED" | "SETTLED" | "REJECTED";
export type Side = "BUY" | "SELL";

export interface OrderRecord {
  id: string;
  userId: string;
  accountId: string;
  symbol: string;
  side: Side;
  quantity: bigint;
  /** Limit price per unit, minor units. Required for buys; it is what cash is checked against. */
  limitPriceMinor: bigint | null;
  currency: string;
  status: OrderStatus;
  brokerOrderId: string;
  brokerId: string;
  filledQuantity: bigint;
  /** Cash spent or received, settled once the order is filled. */
  settledMinor: bigint | null;
  settlementTxId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FillRecord {
  id: string;
  orderId: string;
  brokerFillId: string;
  side: Side;
  quantity: bigint;
  priceMinor: bigint;
  executedAt: Date;
}

export interface InvestmentStore {
  transaction<T>(fn: (tx: InvestmentStore) => Promise<T>): Promise<T>;
  lockAccount(accountId: string): Promise<void>;
  findOrderByKey(userId: string, key: string): Promise<OrderRecord | null>;
  insertOrder(o: Omit<OrderRecord, "status" | "filledQuantity" | "settledMinor" | "settlementTxId" | "createdAt" | "updatedAt"> & { idempotencyKey: string }): Promise<OrderRecord>;
  findOrder(id: string): Promise<OrderRecord | null>;
  listOrders(userId: string, limit: number): Promise<OrderRecord[]>;
  /** Records a fill once. Returns false if this broker fill was already recorded. */
  insertFill(f: Omit<FillRecord, "id">): Promise<boolean>;
  listFills(orderId: string): Promise<FillRecord[]>;
  listFillsForUser(userId: string, symbol?: string): Promise<(FillRecord & { symbol: string })[]>;
  /** Compare-and-set on status, and on the filled quantity so a stale sync cannot move it backwards. */
  updateProgress(id: string, from: OrderStatus[], to: OrderStatus, filledQuantity: bigint, now: Date): Promise<boolean>;
  markSettled(id: string, settledMinor: bigint, settlementTxId: string, now: Date): Promise<boolean>;
  /** Cash held by open buys: sum of (open quantity x limit price) for PLACED and PARTIALLY_FILLED buys. */
  reservedBuyMinor(accountId: string, currency: string): Promise<bigint>;
}

/** Cash in and out, on the ledger. Implemented by the API container over LedgerService. */
export interface CashPort {
  availableMinor(userId: string, currency: string): Promise<bigint>;
  /** Buy: customer pays. Sell: customer receives. Keyed so a repeated call posts once. */
  settleTrade(input: { userId: string; accountId: string; currency: string; side: Side; amountMinor: bigint; idempotencyKey: string; reference: string }): Promise<{ transactionId: string }>;
}

export interface KycGate {
  verified(userId: string): Promise<boolean>;
}

export interface BrokerOrderSnapshot {
  status: "ACCEPTED" | "PARTIALLY_FILLED" | "FILLED" | "REJECTED";
  fills: { brokerFillId: string; quantity: bigint; priceMinor: bigint; executedAt: Date }[];
}

/** Licensed broker port (decisions D8 to D10). Orders are placed with an idempotent client reference. */
export interface BrokerAdapter {
  readonly id: string;
  placeOrder(input: { clientOrderId: string; symbol: string; side: Side; quantity: bigint }): Promise<{ brokerOrderId: string }>;
  getOrder(brokerOrderId: string): Promise<BrokerOrderSnapshot>;
}
