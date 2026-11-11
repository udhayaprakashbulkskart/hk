-- CreateTable
CREATE TABLE "KycRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "tier" VARCHAR(16) NOT NULL,
    "providerRef" VARCHAR(128),
    "rejectionReason" VARCHAR(200),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycIdentity" (
    "userId" TEXT NOT NULL,
    "panEnc" TEXT,
    "panMasked" VARCHAR(16),
    "passportEnc" TEXT,
    "passportMasked" VARCHAR(16),
    "dateOfBirthEnc" TEXT,
    "nationality" VARCHAR(2),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycIdentity_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "KycFile" (
    "id" TEXT NOT NULL,
    "kycRecordId" TEXT NOT NULL,
    "kind" VARCHAR(24) NOT NULL,
    "storageKey" VARCHAR(160) NOT NULL,
    "checksumSha256" VARCHAR(64) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "mimeType" VARCHAR(64) NOT NULL,
    "wrappedKey" TEXT NOT NULL,
    "scanStatus" VARCHAR(16) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceCase" (
    "id" TEXT NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "severity" VARCHAR(8) NOT NULL,
    "blocking" BOOLEAN NOT NULL,
    "subjectType" VARCHAR(16) NOT NULL,
    "subjectId" TEXT NOT NULL,
    "accountId" TEXT,
    "detail" JSONB NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" VARCHAR(64),
    "resolutionNote" VARCHAR(500),

    CONSTRAINT "ComplianceCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreeningResult" (
    "id" TEXT NOT NULL,
    "subjectType" VARCHAR(16) NOT NULL,
    "subjectId" TEXT NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "hitCount" INTEGER NOT NULL,
    "detail" JSONB NOT NULL,
    "screenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreeningResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LimitRule" (
    "id" TEXT NOT NULL,
    "tier" VARCHAR(16) NOT NULL,
    "corridor" VARCHAR(4) NOT NULL,
    "scope" VARCHAR(16) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "amountMinor" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LimitRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KycRecord_userId_key" ON "KycRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "KycFile_storageKey_key" ON "KycFile"("storageKey");

-- CreateIndex
CREATE INDEX "KycFile_kycRecordId_idx" ON "KycFile"("kycRecordId");

-- CreateIndex
CREATE INDEX "ComplianceCase_subjectType_subjectId_status_idx" ON "ComplianceCase"("subjectType", "subjectId", "status");

-- CreateIndex
CREATE INDEX "ComplianceCase_accountId_status_idx" ON "ComplianceCase"("accountId", "status");

-- CreateIndex
CREATE INDEX "ScreeningResult_subjectType_subjectId_idx" ON "ScreeningResult"("subjectType", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "LimitRule_tier_corridor_scope_currency_key" ON "LimitRule"("tier", "corridor", "scope", "currency");

-- AddForeignKey
ALTER TABLE "KycFile" ADD CONSTRAINT "KycFile_kycRecordId_fkey" FOREIGN KEY ("kycRecordId") REFERENCES "KycRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Standard tier (identity verified) limits, in HKD minor units. Basic tier has no outbound limit:
-- basic accounts cannot send externally at all (KYC required). Corridor '*' applies to every destination.
INSERT INTO "LimitRule" ("id","tier","corridor","scope","currency","amountMinor","updatedAt") VALUES
  (gen_random_uuid(), 'STANDARD', '*',  'PER_TX',  'HKD', 5000000,   now()),
  (gen_random_uuid(), 'STANDARD', '*',  'DAILY',   'HKD', 10000000,  now()),
  (gen_random_uuid(), 'STANDARD', '*',  'MONTHLY', 'HKD', 50000000,  now()),
  (gen_random_uuid(), 'STANDARD', 'IN', 'PER_TX',  'HKD', 1000000,   now()),
  (gen_random_uuid(), 'STANDARD', 'IN', 'DAILY',   'HKD', 2000000,   now());
