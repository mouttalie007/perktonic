-- CreateTable
CREATE TABLE "prompt_queue_items" (
    "id" TEXT NOT NULL,
    "writerSlug" TEXT NOT NULL,
    "writerName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "usedAt" TIMESTAMP(3),
    "resultArticleSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_queue_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prompt_queue_items_status_idx" ON "prompt_queue_items"("status");
