import { prisma } from "@/lib/prisma";
import type { ArticleCard } from "./article.service";

/**
 * Trending stories (spec §12, §61).
 * Not hard-coded: ranking is driven by `isTrending` + `trendingRank` /
 * `trendingScore`, with `manualPriority` as an admin override. A scheduled
 * recompute job (score from views/engagement/recency) arrives with the Admin
 * Dashboard; for now editors set the flags.
 */

const cardSelect = {
  id: true,
  type: true,
  title: true,
  slug: true,
  excerpt: true,
  readingTime: true,
  viewCount: true,
  publishedAt: true,
  isBreaking: true,
  featuredImage: { select: { url: true, alt: true, width: true, height: true } },
  category: { select: { slug: true, name: true } },
  author: { select: { slug: true, name: true } },
} as const;

export const trendingService = {
  /** Ordered trending list for the sidebar / trending section (spec §12). */
  async list(limit = 5): Promise<ArticleCard[]> {
    const trending = await prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        publishedAt: { lte: new Date() },
        isTrending: true,
      },
      orderBy: [
        { manualPriority: "asc" },
        { trendingRank: "asc" },
        { trendingScore: "desc" },
        { viewCount: "desc" },
      ],
      take: limit,
      select: cardSelect,
    });
    if (trending.length >= limit) return trending;

    // Backfill with most-viewed recent articles so the module is never sparse.
    const backfill = await prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        publishedAt: { lte: new Date() },
        id: { notIn: trending.map((t) => t.id) },
      },
      orderBy: { viewCount: "desc" },
      take: limit - trending.length,
      select: cardSelect,
    });
    return [...trending, ...backfill];
  },

  /** Single breaking story for the utility-bar ticker (spec §6). */
  async getTicker(): Promise<{ title: string; slug: string } | null> {
    return prisma.article.findFirst({
      where: {
        status: "PUBLISHED",
        publishedAt: { lte: new Date() },
        isBreaking: true,
      },
      orderBy: { publishedAt: "desc" },
      select: { title: true, slug: true },
    });
  },
};
