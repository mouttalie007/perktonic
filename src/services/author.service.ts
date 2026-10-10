import { prisma } from "@/lib/prisma";

/**
 * Public author profile reads (perktonic-seo.md §4.9 — E-E-A-T trust pages).
 * Authors only ever appear via an article byline; there's no admin "publish"
 * step, so any author with at least one published article is reachable.
 */
export const authorService = {
  async getBySlug(slug: string) {
    return prisma.author.findUnique({ where: { slug } });
  },

  /** Slugs for authors with at least one published article (static params). */
  async listPublishedSlugs(): Promise<string[]> {
    const rows = await prisma.author.findMany({
      where: { articles: { some: { status: "PUBLISHED" } } },
      select: { slug: true },
    });
    return rows.map((r) => r.slug);
  },
};
