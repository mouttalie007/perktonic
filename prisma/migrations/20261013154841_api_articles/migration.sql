-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "anthropicApiKeyEnc" TEXT;

-- CreateTable
CREATE TABLE "article_briefs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "briefNo" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "coverPrompt" TEXT,
    "imageSlots" JSONB,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "webSearches" INTEGER,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "articleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "article_briefs_articleId_key" ON "article_briefs"("articleId");

-- CreateIndex
CREATE INDEX "article_briefs_status_idx" ON "article_briefs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "article_briefs_source_briefNo_key" ON "article_briefs"("source", "briefNo");

-- AddForeignKey
ALTER TABLE "article_briefs" ADD CONSTRAINT "article_briefs_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
