/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `Worker` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId]` on the table `Worker` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `organizationId` to the `Asset` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `ServiceRequest` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_areaId_fkey";

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "organizationId" TEXT NOT NULL,
ALTER COLUMN "areaId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "AssetHistory" ADD COLUMN     "details" JSONB;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "logoUrl" TEXT;

-- AlterTable
ALTER TABLE "Provider" ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "routingNumber" TEXT;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "shortlistedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "email" TEXT,
ADD COLUMN     "inviteStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "Asset_organizationId_idx" ON "Asset"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_email_key" ON "Worker"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_userId_key" ON "Worker"("userId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetHistory" ADD CONSTRAINT "AssetHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofOfWork" ADD CONSTRAINT "ProofOfWork_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReworkRequest" ADD CONSTRAINT "ReworkRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
