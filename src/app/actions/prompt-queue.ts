"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-admin";

/**
 * One random still-unused prompt for the "Quick Article" tab. Picked in
 * app code, not `ORDER BY random()` in SQL — the table only ever has ~210
 * rows, so fetching ids and picking one in memory is simpler than a
 * database-specific random-row query, and just as fast at this scale.
 *
 * `writerSlug` scopes the pick to one author's prompts (matches
 * `Author.slug`, unaffected by the PerkTonic rename). There's
 * deliberately no `category` filter: the queue's `category` strings are
 * the old 14-category names from before the pivot and match nothing in
 * the current 4-category taxonomy — filtering on them would just return
 * empty every time.
 */
export async function getRandomPendingPrompt(opts: { writerSlug?: string } = {}) {
  await requireUser("AUTHOR");
  const pendingIds = await prisma.promptQueueItem.findMany({
    where: { status: "pending", ...(opts.writerSlug ? { writerSlug: opts.writerSlug } : {}) },
    select: { id: true },
  });
  if (pendingIds.length === 0) return null;
  const pick = pendingIds[Math.floor(Math.random() * pendingIds.length)];
  return prisma.promptQueueItem.findUnique({ where: { id: pick.id } });
}
