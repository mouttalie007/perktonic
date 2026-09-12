-- CreateEnum
CREATE TYPE "ReactionEmoji" AS ENUM ('LAUGH', 'LOVE', 'WOW', 'ANGRY', 'SAD');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('PENDING', 'APPROVED', 'SPAM');

-- CreateTable
CREATE TABLE "article_reactions" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "emoji" "ReactionEmoji" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "article_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'PENDING',
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "article_reactions_articleId_emoji_key" ON "article_reactions"("articleId", "emoji");

-- CreateIndex
CREATE INDEX "comments_articleId_status_createdAt_idx" ON "comments"("articleId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "comments_status_createdAt_idx" ON "comments"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "article_reactions" ADD CONSTRAINT "article_reactions_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
