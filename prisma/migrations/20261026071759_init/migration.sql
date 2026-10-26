-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('purchase', 'usage', 'refund', 'referral', 'admin_adjust');

-- CreateEnum
CREATE TYPE "HoldStatus" AS ENUM ('active', 'settled', 'released');

-- CreateEnum
CREATE TYPE "PhotoKind" AS ENUM ('selfie', 'fullbody', 'generated');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ageConfirmedAt" TIMESTAMP(3),
    "trialUsedAt" TIMESTAMP(3),
    "referralCode" TEXT NOT NULL,
    "referredById" TEXT,
    "stripeCustomerId" TEXT,
    "frozenAt" TIMESTAMP(3),
    "purchasesBlocked" BOOLEAN NOT NULL DEFAULT false,
    "autoTopUpPackId" TEXT,
    "autoTopUpBelow" INTEGER,
    "lastAutoTopUpAt" TIMESTAMP(3),
    "deleteOriginalsImmediately" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "LedgerType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "usdCents" INTEGER,
    "idempotencyKey" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditHold" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "HoldStatus" NOT NULL DEFAULT 'active',
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "CreditHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrialClaim" (
    "deviceHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrialClaim_pkey" PRIMARY KEY ("deviceHash")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "PhotoKind" NOT NULL,
    "fromCamera" BOOLEAN NOT NULL DEFAULT false,
    "blobPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StyleSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "selfieId" TEXT NOT NULL,
    "fullBodyId" TEXT,
    "vibe" TEXT NOT NULL,
    "customPrompt" TEXT,
    "quiz" JSONB NOT NULL,
    "analysis" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StyleSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Look" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "previewId" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Look_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCall" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "model" TEXT,
    "status" TEXT NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelPrice" (
    "model" TEXT NOT NULL,
    "promptUsd" DOUBLE PRECISION NOT NULL,
    "completionUsd" DOUBLE PRECISION NOT NULL,
    "imageInputUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "imageOutputUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelPrice_pkey" PRIMARY KEY ("model")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_idempotencyKey_key" ON "LedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LedgerEntry_userId_idx" ON "LedgerEntry"("userId");

-- CreateIndex
CREATE INDEX "CreditHold_userId_status_idx" ON "CreditHold"("userId", "status");

-- CreateIndex
CREATE INDEX "Photo_userId_idx" ON "Photo"("userId");

-- CreateIndex
CREATE INDEX "Photo_createdAt_idx" ON "Photo"("createdAt");

-- CreateIndex
CREATE INDEX "StyleSession_userId_createdAt_idx" ON "StyleSession"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Look_sessionId_index_key" ON "Look"("sessionId", "index");

-- CreateIndex
CREATE INDEX "AiCall_createdAt_idx" ON "AiCall"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditHold" ADD CONSTRAINT "CreditHold_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StyleSession" ADD CONSTRAINT "StyleSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Look" ADD CONSTRAINT "Look_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StyleSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCall" ADD CONSTRAINT "AiCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
