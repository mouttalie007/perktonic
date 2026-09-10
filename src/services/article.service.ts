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

const PUBLISHED: Prisma.ArticleWhereInput = {
  status: "PUBLISHED",
  publishedAt: { lte: new Date() },
};

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const articleService = {
  /** Latest published articles (spec §14). */
  async listLatest(limit = 8): Promise<ArticleCard[]> {
    return prisma.article.findMany({
      where: PUBLISHED,
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: cardSelect,
    });
  },

  /** Featured articles for the hero (spec §9, §62). */
  async listFeatured(limit = 3): Promise<ArticleCard[]> {
    return prisma.article.findMany({
      where: { ...PUBLISHED, isFeatured: true },
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
      ...PUBLISHED,
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

  /** Full standard article by slug, or null. */
  async getStandardBySlug(slug: string) {
    return prisma.article.findFirst({
      where: { ...PUBLISHED, slug, type: "STANDARD" },
      include: {
        featuredImage: true,
        ogImage: true,
        category: true,
        author: true,
        tags: { include: { tag: true } },
      },
    });
  },

  /** Full listicle (with ordered items) by slug, or null (spec §4, Phase 4). */
  async getListicleBySlug(slug: string) {
    return prisma.article.findFirst({
      where: { ...PUBLISHED, slug, type: "LISTICLE" },
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

  /** Related stories — same category, most recent, excluding the current one (spec §28). */
  async listRelated(
    articleId: string,
    categoryId: string | null,
    limit = 4,
  ): Promise<ArticleCard[]> {
    return prisma.article.findMany({
      where: {
        ...PUBLISHED,
        id: { not: articleId },
        ...(categoryId ? { categoryId } : {}),
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: cardSelect,
    });
  },

  /** All published slugs (with type) for sitemap / static params (spec §38). */
  async listAllPublishedRefs() {
    return prisma.article.findMany({
      where: PUBLISHED,
      select: { slug: true, type: true, updatedAt: true },
      orderBy: { publishedAt: "desc" },
    });
  },

  /** Fire-and-forget view increment. */
  async incrementViews(id: string): Promise<void> {
    await prisma.article
      .update({ where: { id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});
  },
};
