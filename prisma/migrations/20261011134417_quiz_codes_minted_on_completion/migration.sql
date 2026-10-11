/*
  Warnings:

  - You are about to drop the column `isUsed` on the `quiz_codes` table. All the data in the column will be lost.
  - You are about to drop the column `usedAt` on the `quiz_codes` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "quiz_codes_quizId_isUsed_idx";

-- AlterTable
ALTER TABLE "quiz_codes" DROP COLUMN "isUsed",
DROP COLUMN "usedAt",
ADD COLUMN     "checkedAt" TIMESTAMP(3),
ADD COLUMN     "isChecked" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "quiz_codes_quizId_idx" ON "quiz_codes"("quizId");
