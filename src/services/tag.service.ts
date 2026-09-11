import { prisma } from "@/lib/prisma";

/**
 * Tags (spec §31). Created sparingly — thin tag pages default to `noindex`
 * (Tag.robotsIndex) and the SEO settings switch (`tagPagesIndexable`) can
 * blanket-override that later from the Admin Dashboard.
 */
export const tagService = {
  async getBySlug(slug: string) {
    return prisma.tag.findUnique({ where: { slug } });
  },

  async listAll() {
    return prisma.tag.findMany({ orderBy: { name: "asc" } });
  },
};
