import "server-only";
import { prisma } from "./prisma";

/** Shared reference data for the article/listicle editor sidebars. */
export async function articleFormData() {
  const [categories, authors, tags, media] = await Promise.all([
    prisma.category.findMany({ orderBy: { order: "asc" } }),
    prisma.author.findMany({ orderBy: { name: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
    prisma.media.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  return { categories, authors, tags, media };
}
