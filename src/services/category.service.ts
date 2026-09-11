import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/config/site";

/**
 * Category reads (spec §30). DB rows are the source of truth; if the table is
 * empty (before the seed runs) we fall back to the static config so the nav
 * still renders.
 */
export const categoryService = {
  async listAll() {
    const rows = await prisma.category.findMany({ orderBy: { order: "asc" } });
    if (rows.length > 0) return rows;
    return CATEGORIES.map((c, i) => ({
      id: c.slug,
      slug: c.slug,
      name: c.name,
      description: c.description,
      shortDescription: c.shortDescription,
      imageUrl: null,
      iconKey: c.iconKey,
      accentColor: null,
      order: i,
      seoTitle: null,
      metaDescription: null,
      robotsIndex: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  },

  async getBySlug(slug: string) {
    return prisma.category.findUnique({ where: { slug } });
  },

  /** Indexable categories, for the sitemap (spec §38). */
  async listIndexable() {
    return prisma.category.findMany({
      where: { robotsIndex: true },
      select: { slug: true, updatedAt: true },
      orderBy: { order: "asc" },
    });
  },

  async listSlugs(): Promise<string[]> {
    const rows = await prisma.category.findMany({ select: { slug: true } });
    return rows.length > 0
      ? rows.map((r) => r.slug)
      : CATEGORIES.map((c) => c.slug);
  },
};
