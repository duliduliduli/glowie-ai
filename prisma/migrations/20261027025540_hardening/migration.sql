-- AlterTable
ALTER TABLE "StyleSession" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "PendingCheckout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usdCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingCheckout_userId_idx" ON "PendingCheckout"("userId");

-- AddForeignKey
ALTER TABLE "PendingCheckout" ADD CONSTRAINT "PendingCheckout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
