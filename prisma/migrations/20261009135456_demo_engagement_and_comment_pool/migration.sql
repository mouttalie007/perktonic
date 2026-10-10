-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "isSeed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "demoCommentPool" TEXT,
ALTER COLUMN "tagline" SET DEFAULT 'Find the good stuff before everyone else does.';
