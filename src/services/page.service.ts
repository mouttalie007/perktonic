import { prisma } from "@/lib/prisma";

/**
 * Static / legal pages (spec §20). Route shells always exist; content is
 * managed from the Admin Dashboard (Phase 7). Full editorial styling and the
 * contact form arrive in Phase 8.
 */
export const pageService = {
  async getBySlug(slug: string) {
    return prisma.page.findFirst({
      where: { slug, status: "PUBLISHED" },
    });
  },

  async listPublishedSlugs(): Promise<string[]> {
    const rows = await prisma.page.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true },
    });
    return rows.map((r) => r.slug);
  },
};
