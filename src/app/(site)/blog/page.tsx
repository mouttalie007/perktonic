import type { Metadata } from "next";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { articleService } from "@/services/article.service";
import { categoryService } from "@/services/category.service";
import { interleaveByCategory } from "@/lib/blog-mix";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { StoryGrid } from "@/components/story/StoryGrid";
import { StoryCard } from "@/components/story/StoryCard";
import { BlogControls, blogUrl, type BlogView } from "@/components/story/BlogControls";
import { BlogSidebar } from "@/components/story/BlogSidebar";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";

const PAGE_SIZE = 12;

/** The colour of each category's covers, used for the dots of the filter. */
const COVER_COLOR: Record<string, string> = {
  "spreadsheet-studio": "#E0A800",
  "data-converters": "#7C3AED",
  "document-intelligence": "#DC2626",
  "workflow-automation": "#D9640B",
  "web-diagnostics": "#2563EB",
};

const BLOG_DESCRIPTION =
  "Guides, tutorials and best practices to get more from your spreadsheets, data and workflows.";

/** Page 2+ get their own title and canonical; a category filter is a view of the same list, so it stays out of the index. */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; cat?: string }>;
}): Promise<Metadata> {
  const { page: pageParam, cat } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  if (cat) {
    return { title: "Blog", description: BLOG_DESCRIPTION, alternates: { canonical: "/blog" }, robots: { index: false, follow: true } };
  }
  return {
    title: page > 1 ? `Blog: page ${page}` : "Blog",
    description: page > 1 ? `${BLOG_DESCRIPTION} Page ${page}.` : BLOG_DESCRIPTION,
    alternates: { canonical: page > 1 ? `/blog?page=${page}` : "/blog" },
  };
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; view?: string; cat?: string }>;
}) {
  const { page: pageParam, view: viewParam, cat: catParam } = await searchParams;
  const view: BlogView = viewParam === "grid" ? "grid" : "list";
  const page = Math.max(1, Number(pageParam) || 1);

  const [all, categories, mostRead] = await Promise.all([
    articleService.listAllCards(),
    categoryService.listAll(),
    articleService.listMostRead(5),
  ]);

  // A new site has no view counts yet: show one guide per category instead of five of the same colour.
  const hasViews = mostRead.some((a) => a.viewCount > 0);
  const popular = hasViews ? mostRead : interleaveByCategory(all, categories.map((c) => c.slug)).slice(0, 5);

  // Only categories that already have an article appear in the filter.
  const counts = new Map<string, number>();
  for (const a of all) if (a.category) counts.set(a.category.slug, (counts.get(a.category.slug) ?? 0) + 1);
  const filterCats = categories
    .filter((c) => (counts.get(c.slug) ?? 0) > 0)
    .map((c) => ({ slug: c.slug, name: c.name, count: counts.get(c.slug)!, color: COVER_COLOR[c.slug] ?? c.accentColor }));

  const cat = filterCats.some((c) => c.slug === catParam) ? (catParam as string) : null;
  const shown = cat ? all.filter((a) => a.category?.slug === cat) : all;
  // Mixed order: the categories take turns, so the cover colours alternate.
  const mixed = interleaveByCategory(shown, categories.map((c) => c.slug));

  const totalPages = Math.max(1, Math.ceil(mixed.length / PAGE_SIZE));
  if (mixed.length > 0 && page > totalPages) notFound();
  const items = mixed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="site-container py-8 sm:py-12">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Blog" }]} />
      <header className="mt-4 max-w-3xl">
        <h1 className="font-heading text-navy text-3xl font-extrabold tracking-tight sm:text-4xl">
          Blog
        </h1>
        <p className="text-slate-ink mt-2 text-lg">
          Guides, tutorials and best practices to get more from your tools.
        </p>
      </header>

      {all.length === 0 ? (
        <EmptyState
          className="mt-10"
          title="No articles yet"
          description="New guides are on the way."
        />
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="min-w-0 space-y-6">
            <BlogControls query={{ view, cat, page }} categories={filterCats} total={all.length} />

            <h2 className="sr-only">Guides</h2>
            {view === "grid" ? (
              <StoryGrid stories={items} columns={2} sizes="(max-width: 640px) 100vw, (max-width: 1280px) 45vw, 400px" />
            ) : (
              <div className="space-y-4">
                {items.map((story) => (
                  <StoryCard key={story.id} story={story} variant="row" />
                ))}
              </div>
            )}

            <Pagination
              page={page}
              totalPages={totalPages}
              buildHref={(p): Route => blogUrl({ cat, view, page: p })}
            />
          </div>
          <BlogSidebar popular={popular} title={hasViews ? "Most read" : "Popular guides"} categories={filterCats} />
        </div>
      )}
    </div>
  );
}
