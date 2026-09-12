import { prisma } from "@/lib/prisma";
import type { ReactionEmoji } from "@prisma/client";

/**
 * Emoji reaction counters (homepage redesign, 2026-09-12). Anonymous
 * aggregate counts, no per-visitor identity — see the schema comment on
 * ArticleReaction for the trade-off.
 */

export const REACTION_EMOJI: Record<ReactionEmoji, string> = {
  LAUGH: "😂",
  LOVE: "😍",
  WOW: "😮",
  ANGRY: "😡",
  SAD: "😢",
};

export type ReactionCounts = Partial<Record<ReactionEmoji, number>>;

export const reactionService = {
  /** Counts for a single article, keyed by emoji (zero entries omitted). */
  async getCounts(articleId: string): Promise<ReactionCounts> {
    const rows = await prisma.articleReaction.findMany({
      where: { articleId, count: { gt: 0 } },
      select: { emoji: true, count: true },
    });
    const out: ReactionCounts = {};
    for (const r of rows) out[r.emoji] = r.count;
    return out;
  },

  /** Batch counts for many articles at once (feed rows) — one query, not N. */
  async getCountsForArticles(
    articleIds: string[],
  ): Promise<Map<string, ReactionCounts>> {
    if (articleIds.length === 0) return new Map();
    const rows = await prisma.articleReaction.findMany({
      where: { articleId: { in: articleIds }, count: { gt: 0 } },
      select: { articleId: true, emoji: true, count: true },
    });
    const out = new Map<string, ReactionCounts>();
    for (const r of rows) {
      const entry = out.get(r.articleId) ?? {};
      entry[r.emoji] = r.count;
      out.set(r.articleId, entry);
    }
    return out;
  },

  /** Increment one emoji's counter for an article (upserts the row). */
  async react(articleId: string, emoji: ReactionEmoji): Promise<void> {
    await prisma.articleReaction.upsert({
      where: { articleId_emoji: { articleId, emoji } },
      update: { count: { increment: 1 } },
      create: { articleId, emoji, count: 1 },
    });
  },
};

/** Sum of all emoji counts. */
export function totalReactions(counts: ReactionCounts): number {
  return Object.values(counts).reduce((sum: number, n) => sum + (n ?? 0), 0);
}

/** Top N emoji by count, highest first. */
export function topReactions(
  counts: ReactionCounts,
  n = 2,
): { emoji: ReactionEmoji; count: number }[] {
  return (Object.entries(counts) as [ReactionEmoji, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([emoji, count]) => ({ emoji, count }));
}
