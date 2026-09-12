import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { ArticleCard, Paginated } from "./article.service";

/**
 * Site search (spec §29). Phase 0 uses case-insensitive `contains` over
 * title / excerpt / content — adequate for launch volume. A Postgres
 * full-text (tsvector) or external index can replace the `where` builder
 * later without changing this signature.
 */

export interface SearchParams {
  q: string;
  category?: string;
  sort?: "relevance" | "newest" | "oldest";
  page?: number;
  pageSize?: number;
}

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
  category: { select: { slug: true, name: true, accentColor: true } },
  author: { select: { slug: true, name: true } },
} as const;

export const searchService = {
  async search({
    q,
    category,
    sort = "newest",
    page = 1,
    pageSize = 12,
  }: SearchParams): Promise<Paginated<ArticleCard> & { query: string }> {
    const term = q.trim();
    const where: Prisma.ArticleWhereInput = {
      status: "PUBLISHED",
      publishedAt: { lte: new Date() },
      ...(category ? { category: { slug: category } } : {}),
      ...(term
        ? {
            OR: [
              { title: { contains: term, mode: "insensitive" } },
              { excerpt: { contains: term, mode: "insensitive" } },
              { content: { contains: term, mode: "insensitive" } },
              { intro: { contains: term, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.ArticleOrderByWithRelationInput =
      sort === "oldest"
        ? { publishedAt: "asc" }
        : { publishedAt: "desc" };

    const [items, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: cardSelect,
      }),
      prisma.article.count({ where }),
    ]);

    return {
      query: term,
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },
};
