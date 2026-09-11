import type { Metadata } from "next";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { tagService } from "@/services/tag.service";
import { articleService } from "@/services/article.service";
import { siteSettingsService } from "@/services/site-settings.service";
import { seoService } from "@/services/seo.service";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { StoryGrid } from "@/components/story/StoryGrid";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";

const PAGE_SIZE = 12;

type Params = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

function tagHref(slug: string, page: number): Route {
  return (page > 1 ? `/tag/${slug}?page=${page}` : `/tag/${slug}`) as Route;
}

/**
 * Tag pages (spec §31). Deliberately not statically generated — tags are
 * created sparingly by editors and default to noindex (Tag.robotsIndex AND
 * the SeoSettings.tagPagesIndexable blanket switch) so a thin tag never
 * competes with canonical article/category pages for indexing.
 */
export async function generateMetadata({
  params,
  searchParams,
}: Params): Promise<Metadata> {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const tag = await tagService.getBySlug(slug);
  if (!tag) return { title: "Tag not found" };

  const seo = await siteSettingsService.getSeoSettings();
  const page = Math.max(1, Number(pageParam) || 1);
  return seoService.buildMetadata({
    title: `${tag.name}`,
    description: `Stories tagged “${tag.name}” on ViralTrendly.`,
    path: tagHref(slug, page),
    robotsIndex: seo.tagPagesIndexable && tag.robotsIndex,
  });
}

export default async function TagPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const tag = await tagService.getBySlug(slug);
  if (!tag) notFound();

  const page = Math.max(1, Number(pageParam) || 1);
  const { items, total, totalPages } = await articleService.listByTag(slug, {
    page,
    pageSize: PAGE_SIZE,
  });
  if (total > 0 && page > totalPages) notFound();

  return (
    <div className="site-container py-8 sm:py-10">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: tag.name }]} />

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
        {tag.name}
      </h1>
      <p className="text-muted mt-2 text-sm">
        {total} {total === 1 ? "story" : "stories"} tagged “{tag.name}”
      </p>

      <div className="mt-10">
        {total === 0 ? (
          <EmptyState
            title={`Nothing tagged “${tag.name}” yet`}
            description="Browse a category from the menu instead — new stories are added regularly."
          />
        ) : (
          <>
            <StoryGrid stories={items} columns={4} />
            <Pagination
              page={page}
              totalPages={totalPages}
              buildHref={(p) => tagHref(slug, p)}
              className="mt-10"
            />
          </>
        )}
      </div>
    </div>
  );
}
