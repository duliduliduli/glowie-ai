-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PhotoKind" ADD VALUE 'outfit';
ALTER TYPE "PhotoKind" ADD VALUE 'video';

-- AlterTable
ALTER TABLE "Look" ADD COLUMN     "hairStages" JSONB,
ADD COLUMN     "hairStatus" TEXT,
ADD COLUMN     "videoId" TEXT,
ADD COLUMN     "videoStatus" TEXT;

-- AlterTable
ALTER TABLE "StyleSession" ADD COLUMN     "extra" JSONB;

-- AlterTable
-- Keep existing claims: rename the column and namespace old values as device hashes.
ALTER TABLE "TrialClaim" RENAME COLUMN "deviceHash" TO "key";
UPDATE "TrialClaim" SET "key" = 'device:' || "key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "freePreviews" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lookAId" TEXT NOT NULL,
    "lookBId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyVote" (
    "id" TEXT NOT NULL,
    "partyId" TEXT NOT NULL,
    "choice" INTEGER NOT NULL,
    "voterHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareLink" (
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "Roast" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Roast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Party_token_key" ON "Party"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PartyVote_partyId_voterHash_key" ON "PartyVote"("partyId", "voterHash");

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_kind_refId_key" ON "ShareLink"("kind", "refId");

-- CreateIndex
CREATE INDEX "Roast_userId_createdAt_idx" ON "Roast"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyVote" ADD CONSTRAINT "PartyVote_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roast" ADD CONSTRAINT "Roast_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
