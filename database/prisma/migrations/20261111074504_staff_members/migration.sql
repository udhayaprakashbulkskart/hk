-- CreateTable
CREATE TABLE "StaffMember" (
    "userId" TEXT NOT NULL,
    "role" VARCHAR(24) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "createdBy" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("userId")
);
