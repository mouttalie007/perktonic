import type { Metadata } from "next";
import type { Route } from "next";
import { searchService } from "@/services/search.service";
import { siteSettingsService } from "@/services/site-settings.service";
import { seoService } from "@/services/seo.service";
import { CATEGORIES } from "@/config/site";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { SearchControls } from "@/components/search/SearchControls";
import { StoryGrid } from "@/components/story/StoryGrid";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";

const PAGE_SIZE = 12;

type Params = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
    page?: string;
  }>;
};

function readParams(sp: Awaited<Params["searchParams"]>) {
  return {
    q: (sp.q ?? "").trim(),
    category: sp.category ?? "",
    sort: sp.sort === "oldest" ? "oldest" : "newest",
    page: Math.max(1, Number(sp.page) || 1),
  } as const;
}

/**
 * Internal search results (spec §29). Kept out of the index by default
 * (SeoSettings.searchPagesIndexable) — query-string pages have no lasting
 * SEO value and multiply endlessly, so we don't compete for indexing with
 * canonical article/category pages.
 */
export async function generateMetadata({ searchParams }: Params): Promise<Metadata> {
  const { q } = readParams(await searchParams);
  const seo = await siteSettingsService.getSeoSettings();
  return seoService.buildMetadata({
    title: q ? `Search results for “${q}”` : "Search",
    description: `Search ViralTrendly for trending stories, people, tech, lifestyle and more.`,
    path: "/search",
    robotsIndex: seo.searchPagesIndexable,
  });
}

export default async function SearchPage({ searchParams }: Params) {
  const { q, category, sort, page } = readParams(await searchParams);

  const results = q
    ? await searchService.search({ q, category: category || undefined, sort, page, pageSize: PAGE_SIZE })
    : null;

  function buildHref(p: number): Route {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (sort !== "newest") params.set("sort", sort);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return (qs ? `/search?${qs}` : "/search") as Route;
  }

  return (
    <div className="site-container py-8 sm:py-10">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Search" }]} />

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
        Search
      </h1>

      <SearchControls
        categories={CATEGORIES}
        initial={{ q, category, sort }}
      />

      <div className="mt-10">
        {!q ? (
          <EmptyState
            title="Search ViralTrendly"
            description="Type a keyword above to search trending stories, people, tech, lifestyle, travel and more."
          />
        ) : results && results.total > 0 ? (
          <>
            <p className="text-muted mb-6 text-sm">
              {results.total} {results.total === 1 ? "result" : "results"} for
              <span className="text-ink font-semibold"> “{q}”</span>
            </p>
            <StoryGrid stories={results.items} columns={3} />
            <Pagination
              page={results.page}
              totalPages={results.totalPages}
              buildHref={buildHref}
              className="mt-10"
            />
          </>
        ) : (
          <EmptyState
            title={`No results for “${q}”`}
            description="Try a different keyword, remove the category filter, or browse a category from the menu instead."
          />
        )}
      </div>
    </div>
  );
}
