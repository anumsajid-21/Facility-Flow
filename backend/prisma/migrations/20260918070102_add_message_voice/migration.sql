-- AlterEnum
ALTER TYPE "FileKind" ADD VALUE 'MESSAGE_AUDIO';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "audioFileId" TEXT,
ADD COLUMN     "audioSeconds" INTEGER;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_audioFileId_fkey" FOREIGN KEY ("audioFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
