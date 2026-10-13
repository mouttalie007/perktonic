import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateBrief } from "./generate";

/**
 * A tiny in-process, one-at-a-time worker. The site runs as one long-lived
 * Node process under Passenger, so a detached promise keeps going after the
 * HTTP request that started it returns; the admin page polls the brief
 * rows for progress. One at a time on purpose: shared hosting caps
 * processes/CPU, and the Claude API rate limits parallel long requests.
 *
 * It does not survive a server restart (a deploy). A brief left QUEUED or
 * GENERATING by a dead process is swept to FAILED after STALE_MS by
 * sweepStaleBriefs(), after which "Retry" simply enqueues it again. The
 * rule is time-only (not "is it in my memory") so it stays correct if
 * Passenger ever runs more than one process.
 */

const STALE_MS = 25 * 60 * 1000;

interface QueueState {
  running: boolean;
  ids: string[];
}
const g = globalThis as unknown as { __aiArticleQueue?: QueueState };
const state = (): QueueState => (g.__aiArticleQueue ??= { running: false, ids: [] });

async function runQueue(): Promise<void> {
  const q = state();
  if (q.running) return;
  q.running = true;
  try {
    while (q.ids.length) {
      const id = q.ids.shift()!;
      await generateBrief(id);
    }
  } finally {
    q.running = false;
  }
}

/** Marks the briefs QUEUED and starts the worker (fire-and-forget). */
export async function enqueueBriefs(ids: string[]): Promise<number> {
  const q = state();
  const eligible = await prisma.articleBrief.findMany({
    where: { id: { in: ids }, status: { in: ["PENDING", "FAILED", "DRAFTED"] } },
    select: { id: true },
  });
  const fresh = eligible.map((b) => b.id).filter((id) => !q.ids.includes(id));
  if (fresh.length === 0) return 0;

  await prisma.articleBrief.updateMany({
    where: { id: { in: fresh } },
    data: { status: "QUEUED", error: null },
  });
  q.ids.push(...fresh);
  void runQueue();
  return fresh.length;
}

/**
 * Housekeeping run on every board load: FAILED-ifies briefs a dead process
 * left QUEUED/GENERATING, and briefs whose article was deleted from the
 * normal Articles page (so "Retry" can write them again).
 */
export async function sweepStaleBriefs(): Promise<void> {
  await prisma.articleBrief.updateMany({
    where: { status: { in: ["DRAFTED", "PUBLISHED"] }, articleId: null },
    data: {
      status: "FAILED",
      error: "The article was deleted. Press Retry to write it again.",
      imageSlots: Prisma.DbNull,
      finishedAt: new Date(),
    },
  });
  await prisma.articleBrief.updateMany({
    where: {
      status: { in: ["QUEUED", "GENERATING"] },
      updatedAt: { lt: new Date(Date.now() - STALE_MS) },
    },
    data: {
      status: "FAILED",
      error: "Interrupted (the server restarted while this was running). Press Retry.",
      finishedAt: new Date(),
    },
  });
}
