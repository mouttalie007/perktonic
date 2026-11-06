import { prisma } from "@/lib/prisma";
import type { ReactionEmoji } from "@prisma/client";

/**
 * Reaction counters; today only the "Was this guide helpful?" votes (HELPFUL / NOT_HELPFUL) are used. Anonymous
 * aggregate counts, no per-visitor identity — see the schema comment on
 * ArticleReaction for the trade-off.
 */

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

