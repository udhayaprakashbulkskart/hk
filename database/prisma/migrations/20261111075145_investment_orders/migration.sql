-- CreateTable
CREATE TABLE "InvestmentOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "symbol" VARCHAR(12) NOT NULL,
    "side" VARCHAR(4) NOT NULL,
    "quantity" BIGINT NOT NULL,
    "limitPriceMinor" BIGINT,
    "currency" VARCHAR(3) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "brokerOrderId" VARCHAR(64) NOT NULL,
    "brokerId" VARCHAR(32) NOT NULL,
    "filledQuantity" BIGINT NOT NULL DEFAULT 0,
    "settledMinor" BIGINT,
    "settlementTxId" TEXT,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentFill" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "brokerFillId" VARCHAR(128) NOT NULL,
    "side" VARCHAR(4) NOT NULL,
    "quantity" BIGINT NOT NULL,
    "priceMinor" BIGINT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentFill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvestmentOrder_userId_createdAt_idx" ON "InvestmentOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "InvestmentOrder_accountId_status_idx" ON "InvestmentOrder"("accountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentOrder_userId_idempotencyKey_key" ON "InvestmentOrder"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentFill_brokerFillId_key" ON "InvestmentFill"("brokerFillId");

-- CreateIndex
CREATE INDEX "InvestmentFill_orderId_idx" ON "InvestmentFill"("orderId");

-- AddForeignKey
ALTER TABLE "InvestmentFill" ADD CONSTRAINT "InvestmentFill_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "InvestmentOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
