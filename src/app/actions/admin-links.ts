"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-admin";
import { seoService } from "@/services/seo.service";

export interface LinkSuggestion {
  id: string;
  title: string;
  slug: string;
  linkHtml: string;
}

/**
 * Suggested internal links for the article editor (per feedback — shown
 * once the writer has 3+ paragraphs). Heuristic, not AI: same category first
 * (most-viewed), falling back to recent published articles; an optional
 * keyword search narrows it further. Each result comes with a ready-to-copy
 * <a> snippet — paste it into the body with Ctrl+V like a pasted image.
 */
export async function suggestInternalLinks({
  categoryId,
  excludeId,
  query,
}: {
  categoryId?: string;
  excludeId?: string;
  query?: string;
}): Promise<LinkSuggestion[]> {
  await requireUser("AUTHOR");

  const where = {
    status: "PUBLISHED" as const,
    ...(excludeId ? { id: { not: excludeId } } : {}),
    ...(query?.trim()
      ? { title: { contains: query.trim(), mode: "insensitive" as const } }
      : {}),
  };

  const rows = await prisma.article.findMany({
    where: query?.trim() ? where : { ...where, ...(categoryId ? { categoryId } : {}) },
    orderBy: query?.trim() ? { publishedAt: "desc" } : { viewCount: "desc" },
    take: 5,
    select: { id: true, title: true, slug: true },
  });

  // Backfill with recent articles if a category had too few.
  if (!query?.trim() && rows.length < 5) {
    const more = await prisma.article.findMany({
      where: { ...where, id: { notIn: [excludeId, ...rows.map((r) => r.id)].filter(Boolean) as string[] } },
      orderBy: { publishedAt: "desc" },
      take: 5 - rows.length,
      select: { id: true, title: true, slug: true },
    });
    rows.push(...more);
  }

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    linkHtml: `<a href="${seoService.absoluteUrl(`/story/${r.slug}`)}">${r.title}</a>`,
  }));
}
