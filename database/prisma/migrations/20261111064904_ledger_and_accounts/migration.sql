-- CreateEnum
CREATE TYPE "LedgerOwnerType" AS ENUM ('CUSTOMER', 'PLATFORM');

-- CreateEnum
CREATE TYPE "LedgerSide" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "LedgerTxKind" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER_HOLD', 'TRANSFER_SETTLE', 'TRANSFER_RELEASE', 'FX_CONVERSION', 'FEE', 'REVERSAL', 'ADJUSTMENT', 'TRADE_SETTLEMENT');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Currency" (
    "code" VARCHAR(3) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "symbol" VARCHAR(8) NOT NULL,
    "minorUnitExponent" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountRef" VARCHAR(16) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurrencyAccount" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "availableLedgerId" TEXT NOT NULL,
    "holdLedgerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurrencyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beneficiary" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "country" VARCHAR(2) NOT NULL,
    "method" VARCHAR(8) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "destinationEnc" TEXT NOT NULL,
    "destinationMasked" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Beneficiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "ownerType" "LedgerOwnerType" NOT NULL,
    "ownerId" VARCHAR(64) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "purpose" VARCHAR(32) NOT NULL,
    "normalSide" "LedgerSide" NOT NULL,
    "allowNegative" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerBalance" (
    "ledgerAccountId" TEXT NOT NULL,
    "balanceMinor" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerBalance_pkey" PRIMARY KEY ("ledgerAccountId")
);

-- CreateTable
CREATE TABLE "LedgerTransaction" (
    "id" TEXT NOT NULL,
    "kind" "LedgerTxKind" NOT NULL,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "requestHash" VARCHAR(64) NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "reference" VARCHAR(128),
    "reversesId" TEXT,
    "createdBy" VARCHAR(64),
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "ledgerAccountId" TEXT NOT NULL,
    "side" "LedgerSide" NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationRecord" (
    "id" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ledgerAccountId" TEXT NOT NULL,
    "expectedMinor" BIGINT NOT NULL,
    "recordedMinor" BIGINT NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReconciliationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "payload" JSONB NOT NULL,
    "requestedBy" VARCHAR(64) NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decidedBy" VARCHAR(64),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_userId_key" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_accountRef_key" ON "Account"("accountRef");

-- CreateIndex
CREATE UNIQUE INDEX "CurrencyAccount_availableLedgerId_key" ON "CurrencyAccount"("availableLedgerId");

-- CreateIndex
CREATE UNIQUE INDEX "CurrencyAccount_holdLedgerId_key" ON "CurrencyAccount"("holdLedgerId");

-- CreateIndex
CREATE UNIQUE INDEX "CurrencyAccount_accountId_currency_key" ON "CurrencyAccount"("accountId", "currency");

-- CreateIndex
CREATE INDEX "Beneficiary_accountId_idx" ON "Beneficiary"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_ownerType_ownerId_currency_purpose_key" ON "LedgerAccount"("ownerType", "ownerId", "currency", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerTransaction_idempotencyKey_key" ON "LedgerTransaction"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerTransaction_reversesId_key" ON "LedgerTransaction"("reversesId");

-- CreateIndex
CREATE INDEX "LedgerEntry_transactionId_idx" ON "LedgerEntry"("transactionId");

-- CreateIndex
CREATE INDEX "LedgerEntry_ledgerAccountId_createdAt_idx" ON "LedgerEntry"("ledgerAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "ReconciliationRecord_status_runAt_idx" ON "ReconciliationRecord"("status", "runAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurrencyAccount" ADD CONSTRAINT "CurrencyAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beneficiary" ADD CONSTRAINT "Beneficiary_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerBalance" ADD CONSTRAINT "LedgerBalance_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "LedgerTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Ledger integrity rules. These live in the database so no application path can skip them.
-- ============================================================================

-- Launch currencies (kept in step with packages/shared CURRENCY_META).
INSERT INTO "Currency" ("code","name","symbol","minorUnitExponent","isEnabled") VALUES
  ('HKD','Hong Kong dollar','HK$',2,true),
  ('USD','US dollar','US$',2,true),
  ('INR','Indian rupee','₹',2,true),
  ('EUR','Euro','€',2,true),
  ('GBP','Pound sterling','£',2,true),
  ('AED','UAE dirham','AED',2,true),
  ('SGD','Singapore dollar','S$',2,true),
  ('CNY','Chinese yuan','¥',2,true);

-- 1. Posted money records are immutable. UPDATE and DELETE are rejected for every role.
CREATE OR REPLACE FUNCTION ledger_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger records are immutable (% rejected)', TG_OP USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entry_immutable BEFORE UPDATE OR DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION ledger_immutable();
CREATE TRIGGER ledger_transaction_immutable BEFORE UPDATE OR DELETE ON "LedgerTransaction"
  FOR EACH ROW EXECUTE FUNCTION ledger_immutable();

-- 2. Balances may only change inside the posting function, which sets hkf.ledger_write for the
--    transaction. Any other writer, including a direct UPDATE, is rejected.
CREATE OR REPLACE FUNCTION ledger_balance_write_guard() RETURNS trigger AS $$
BEGIN
  IF current_setting('hkf.ledger_write', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'balances change only through the ledger posting function' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_balance_guard BEFORE INSERT OR UPDATE ON "LedgerBalance"
  FOR EACH ROW EXECUTE FUNCTION ledger_balance_write_guard();

-- 3. No overdraft. Customer accounts (allowNegative = false) must never go below zero.
CREATE OR REPLACE FUNCTION ledger_balance_floor() RETURNS trigger AS $$
DECLARE
  allow boolean;
BEGIN
  SELECT "allowNegative" INTO allow FROM "LedgerAccount" WHERE "id" = NEW."ledgerAccountId";
  IF NEW."balanceMinor" < 0 AND NOT allow THEN
    RAISE EXCEPTION 'insufficient funds' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_balance_no_overdraft BEFORE INSERT OR UPDATE ON "LedgerBalance"
  FOR EACH ROW EXECUTE FUNCTION ledger_balance_floor();

-- 4. Each posting's entries must balance per currency. Checked at COMMIT, so a transaction
--    that is half-written cannot be committed.
CREATE OR REPLACE FUNCTION ledger_transaction_balanced() RETURNS trigger AS $$
DECLARE
  bad record;
BEGIN
  FOR bad IN
    SELECT "currency", SUM(CASE WHEN "side" = 'DEBIT' THEN "amountMinor" ELSE -"amountMinor" END) AS net
    FROM "LedgerEntry"
    WHERE "transactionId" = NEW."transactionId"
    GROUP BY "currency"
    HAVING SUM(CASE WHEN "side" = 'DEBIT' THEN "amountMinor" ELSE -"amountMinor" END) <> 0
  LOOP
    RAISE EXCEPTION 'unbalanced ledger transaction in % (net %)', bad."currency", bad.net USING ERRCODE = 'check_violation';
  END LOOP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ledger_entry_balanced AFTER INSERT ON "LedgerEntry"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ledger_transaction_balanced();

-- 5. An entry's currency must match its ledger account's currency, and amounts are positive.
CREATE OR REPLACE FUNCTION ledger_entry_currency_match() RETURNS trigger AS $$
DECLARE
  acct_currency text;
BEGIN
  SELECT "currency" INTO acct_currency FROM "LedgerAccount" WHERE "id" = NEW."ledgerAccountId";
  IF acct_currency IS DISTINCT FROM NEW."currency" THEN
    RAISE EXCEPTION 'entry currency % does not match account currency %', NEW."currency", acct_currency USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entry_currency BEFORE INSERT ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION ledger_entry_currency_match();

ALTER TABLE "LedgerEntry" ADD CONSTRAINT ledger_entry_positive CHECK ("amountMinor" > 0);
