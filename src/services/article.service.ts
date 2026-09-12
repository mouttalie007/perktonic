import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Article reads for the public site (spec §64).
 * Writes and status transitions live in the Admin Dashboard (Phase 7).
 */

/** Fields every card/list needs. */
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
  featuredImage: {
    select: { url: true, alt: true, width: true, height: true },
  },
  category: { select: { slug: true, name: true } },
  author: { select: { slug: true, name: true } },
} satisfies Prisma.ArticleSelect;

export type ArticleCard = Prisma.ArticleGetPayload<{ select: typeof cardSelect }>;

/**
 * A function, not a module-level constant — `new Date()` must be evaluated
 * fresh on every call. A frozen constant would bake in the timestamp from
 * whenever this module first loaded (server boot / first HMR compile) and
 * silently hide every article published after that moment for the rest of
 * the process's life. (Found via an admin smoke test: a just-published
 * listicle 404'd on the public site until the dev module reloaded.)
 */
function published(): Prisma.ArticleWhereInput {
  return { status: "PUBLISHED", publishedAt: { lte: new Date() } };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const articleService = {
  /** Latest published articles (spec §14). */
  async listLatest({
    limit = 8,
    excludeIds = [],
  }: { limit?: number; excludeIds?: string[] } = {}): Promise<ArticleCard[]> {
    return prisma.article.findMany({
      where:
        excludeIds.length > 0
          ? { ...published(), id: { notIn: excludeIds } }
          : published(),
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: cardSelect,
    });
  },

  /**
   * Paginated latest-across-all-categories feed (homepage redesign,
   * 2026-09-12) — the main feed below the Trending rail, 12/page.
   */
  async listFeed(
    { page = 1, pageSize = 12 }: { page?: number; pageSize?: number } = {},
  ): Promise<Paginated<ArticleCard>> {
    const where = published();
    const [items, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: cardSelect,
      }),
      prisma.article.count({ where }),
    ]);
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  /** Featured articles for the hero (spec §9, §62). */
  async listFeatured(limit = 3): Promise<ArticleCard[]> {
    return prisma.article.findMany({
      where: { ...published(), isFeatured: true },
      orderBy: [{ manualPriority: "asc" }, { publishedAt: "desc" }],
      take: limit,
      select: cardSelect,
    });
  },

  /** Paginated list for a category page (spec §30, §70). */
  async listByCategory(
    categorySlug: string,
    { page = 1, pageSize = 12 }: { page?: number; pageSize?: number } = {},
  ): Promise<Paginated<ArticleCard>> {
    const where: Prisma.ArticleWhereInput = {
      ...published(),
      category: { slug: categorySlug },
    };
    const [items, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: cardSelect,
      }),
      prisma.article.count({ where }),
    ]);
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  /** Paginated list for a tag page (spec §31, §70). */
  async listByTag(
    tagSlug: string,
    { page = 1, pageSize = 12 }: { page?: number; pageSize?: number } = {},
  ): Promise<Paginated<ArticleCard>> {
    const where: Prisma.ArticleWhereInput = {
      ...published(),
      tags: { some: { tag: { slug: tagSlug } } },
    };
    const [items, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: cardSelect,
      }),
      prisma.article.count({ where }),
    ]);
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  /** Top-viewed stories within a category, for a category page's aside. */
  async listTopViewedInCategory(
    categoryId: string,
    limit = 4,
  ): Promise<ArticleCard[]> {
    return prisma.article.findMany({
      where: { ...published(), categoryId },
      orderBy: { viewCount: "desc" },
      take: limit,
      select: cardSelect,
    });
  },

  /** Full standard article by slug, or null. */
  async getStandardBySlug(slug: string) {
    return prisma.article.findFirst({
      where: { ...published(), slug, type: "STANDARD" },
      include: {
        featuredImage: true,
        ogImage: true,
        category: true,
        author: true,
        tags: { include: { tag: true } },
      },
    });
  },

  /** Any published article (either type) by slug, with everything a page needs. */
  async getForRender(slug: string) {
    return prisma.article.findFirst({
      where: { ...published(), slug },
      include: {
        featuredImage: true,
        ogImage: true,
        category: true,
        author: true,
        tags: { include: { tag: true } },
        listicleItems: {
          orderBy: { position: "asc" },
          include: { media: true },
        },
      },
    });
  },

  /** Full listicle (with ordered items) by slug, or null (spec §4, Phase 4). */
  async getListicleBySlug(slug: string) {
    return prisma.article.findFirst({
      where: { ...published(), slug, type: "LISTICLE" },
      include: {
        featuredImage: true,
        ogImage: true,
        category: true,
        author: true,
        tags: { include: { tag: true } },
        listicleItems: {
          orderBy: { position: "asc" },
          include: { media: true },
        },
      },
    });
  },

  /**
   * Related stories (spec §28): same category first, then backfilled with
   * recent stories from elsewhere so the block is never empty.
   */
  async listRelated(
    articleId: string,
    categoryId: string | null,
    limit = 4,
  ): Promise<ArticleCard[]> {
    const sameCategory = categoryId
      ? await prisma.article.findMany({
          where: { ...published(), id: { not: articleId }, categoryId },
          orderBy: { publishedAt: "desc" },
          take: limit,
          select: cardSelect,
        })
      : [];

    if (sameCategory.length >= limit) return sameCategory;

    const backfill = await prisma.article.findMany({
      where: {
        ...published(),
        id: { notIn: [articleId, ...sameCategory.map((a) => a.id)] },
      },
      orderBy: { publishedAt: "desc" },
      take: limit - sameCategory.length,
      select: cardSelect,
    });
    return [...sameCategory, ...backfill];
  },

  /** All published slugs (with type) for sitemap / static params (spec §38). */
  async listAllPublishedRefs() {
    return prisma.article.findMany({
      where: published(),
      select: { slug: true, type: true, updatedAt: true },
      orderBy: { publishedAt: "desc" },
    });
  },

  /** Indexable articles for the sitemap (spec §38) — includes indexable
   *  listicle subpages when the article opts in via listicleIndexSubpages. */
  async listSitemapRefs() {
    return prisma.article.findMany({
      where: { ...published(), robotsIndex: true },
      select: {
        slug: true,
        type: true,
        updatedAt: true,
        listicleIndexSubpages: true,
        _count: { select: { listicleItems: true } },
      },
      orderBy: { publishedAt: "desc" },
    });
  },

  /** Published listicles with their item counts, for subpage static params. */
  async listListicleRefs() {
    return prisma.article.findMany({
      where: { ...published(), type: "LISTICLE" },
      select: {
        slug: true,
        updatedAt: true,
        _count: { select: { listicleItems: true } },
      },
    });
  },

  /** Fire-and-forget view increment. */
  async incrementViews(id: string): Promise<void> {
    await prisma.article
      .update({ where: { id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});
  },
};
