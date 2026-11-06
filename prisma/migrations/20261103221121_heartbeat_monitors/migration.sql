-- CreateTable
CREATE TABLE "heartbeat_monitors" (
    "id" TEXT NOT NULL,
    "pingTokenHash" TEXT NOT NULL,
    "manageTokenHash" TEXT NOT NULL,
    "emailHashes" TEXT[],
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,

    CONSTRAINT "heartbeat_monitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "heartbeat_pings" (
    "id" SERIAL NOT NULL,
    "monitorId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "durationMs" INTEGER,
    "message" TEXT,
    "ip" TEXT,

    CONSTRAINT "heartbeat_pings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "heartbeat_events" (
    "id" SERIAL NOT NULL,
    "monitorId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,

    CONSTRAINT "heartbeat_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "heartbeat_monitors_pingTokenHash_key" ON "heartbeat_monitors"("pingTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "heartbeat_monitors_manageTokenHash_key" ON "heartbeat_monitors"("manageTokenHash");

-- CreateIndex
CREATE INDEX "heartbeat_monitors_paused_activityAt_idx" ON "heartbeat_monitors"("paused", "activityAt");

-- CreateIndex
CREATE INDEX "heartbeat_monitors_emailHashes_idx" ON "heartbeat_monitors" USING GIN ("emailHashes");

-- CreateIndex
CREATE INDEX "heartbeat_pings_monitorId_id_idx" ON "heartbeat_pings"("monitorId", "id" DESC);

-- CreateIndex
CREATE INDEX "heartbeat_events_monitorId_id_idx" ON "heartbeat_events"("monitorId", "id" DESC);

-- AddForeignKey
ALTER TABLE "heartbeat_pings" ADD CONSTRAINT "heartbeat_pings_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "heartbeat_monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "heartbeat_events" ADD CONSTRAINT "heartbeat_events_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "heartbeat_monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
