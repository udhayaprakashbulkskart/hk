-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('COLLECTION', 'PAYOUT');

-- CreateEnum
CREATE TYPE "PaymentStatusDb" AS ENUM ('CREATED', 'PENDING', 'SUBMITTED', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- AlterEnum
ALTER TYPE "LedgerTxKind" ADD VALUE 'INTERNAL_TRANSFER';

-- CreateTable
CREATE TABLE "ProviderCapability" (
    "id" TEXT NOT NULL,
    "providerId" VARCHAR(32) NOT NULL,
    "environment" VARCHAR(8) NOT NULL,
    "direction" "PaymentDirection" NOT NULL,
    "country" VARCHAR(2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "method" VARCHAR(8) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProviderCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderApproval" (
    "id" TEXT NOT NULL,
    "providerId" VARCHAR(32) NOT NULL,
    "environment" VARCHAR(8) NOT NULL,
    "contractRef" VARCHAR(64) NOT NULL,
    "approvedBy" VARCHAR(64) NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "direction" "PaymentDirection" NOT NULL,
    "providerId" VARCHAR(32) NOT NULL,
    "environment" VARCHAR(8) NOT NULL,
    "providerRef" VARCHAR(128),
    "reference" VARCHAR(64) NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "accountId" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "method" VARCHAR(8) NOT NULL,
    "country" VARCHAR(2) NOT NULL,
    "status" "PaymentStatusDb" NOT NULL,
    "transferId" TEXT,
    "metadata" JSONB NOT NULL,
    "ledgerTransactionId" TEXT,
    "failureReason" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderWebhook" (
    "id" TEXT NOT NULL,
    "providerId" VARCHAR(32) NOT NULL,
    "eventId" VARCHAR(160) NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "outcome" VARCHAR(32),

    CONSTRAINT "ProviderWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FxQuote" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "fromCurrency" VARCHAR(3) NOT NULL,
    "toCurrency" VARCHAR(3) NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "feeMinor" BIGINT NOT NULL,
    "recipientMinor" BIGINT NOT NULL,
    "rateScaled" BIGINT NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "quotedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "ledgerTransactionId" TEXT,

    CONSTRAINT "FxQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "sourceCurrency" VARCHAR(3) NOT NULL,
    "sourceMinor" BIGINT NOT NULL,
    "feeMinor" BIGINT NOT NULL,
    "recipientCurrency" VARCHAR(3) NOT NULL,
    "recipientMinor" BIGINT NOT NULL,
    "fxQuoteId" TEXT,
    "recipientAccountId" TEXT,
    "destinationMasked" VARCHAR(64),
    "method" VARCHAR(8),
    "country" VARCHAR(2),
    "paymentId" TEXT,
    "ledgerTransactionId" TEXT,
    "failureReason" VARCHAR(200),
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRequest" (
    "ref" VARCHAR(16) NOT NULL,
    "accountId" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "amountMinor" BIGINT,
    "memo" VARCHAR(80) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("ref")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderCapability_providerId_environment_direction_country_key" ON "ProviderCapability"("providerId", "environment", "direction", "country", "currency", "method");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderApproval_providerId_environment_key" ON "ProviderApproval"("providerId", "environment");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transferId_key" ON "Payment"("transferId");

-- CreateIndex
CREATE INDEX "Payment_accountId_createdAt_idx" ON "Payment"("accountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerId_providerRef_key" ON "Payment"("providerId", "providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderWebhook_providerId_eventId_key" ON "ProviderWebhook"("providerId", "eventId");

-- CreateIndex
CREATE INDEX "FxQuote_accountId_quotedAt_idx" ON "FxQuote"("accountId", "quotedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_paymentId_key" ON "Transfer"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_idempotencyKey_key" ON "Transfer"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Transfer_accountId_createdAt_idx" ON "Transfer"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "Transfer_accountId_sourceCurrency_status_idx" ON "Transfer"("accountId", "sourceCurrency", "status");

-- CreateIndex
CREATE INDEX "PaymentRequest_accountId_createdAt_idx" ON "PaymentRequest"("accountId", "createdAt");

-- Launch routes. Sandbox routes are enabled; live routes exist but stay disabled, so live money has no
-- path until a provider is approved and its route is switched on (see ProviderApproval).
INSERT INTO "ProviderCapability" ("id","providerId","environment","direction","country","currency","method","enabled") VALUES
  (gen_random_uuid(), 'stripe',   'sandbox', 'COLLECTION', 'HK', 'HKD', 'card', true),
  (gen_random_uuid(), 'razorpay', 'sandbox', 'COLLECTION', 'IN', 'INR', 'upi',  true),
  (gen_random_uuid(), 'razorpayx','sandbox', 'PAYOUT',     'IN', 'INR', 'upi',  true),
  (gen_random_uuid(), 'razorpayx','sandbox', 'PAYOUT',     'IN', 'INR', 'bank', true),
  (gen_random_uuid(), 'stripe',   'live',    'COLLECTION', 'HK', 'HKD', 'card', false),
  (gen_random_uuid(), 'razorpay', 'live',    'COLLECTION', 'IN', 'INR', 'upi',  false),
  (gen_random_uuid(), 'razorpayx','live',    'PAYOUT',     'IN', 'INR', 'upi',  false),
  (gen_random_uuid(), 'razorpayx','live',    'PAYOUT',     'IN', 'INR', 'bank', false);
