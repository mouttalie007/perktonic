import type { Metadata } from "next";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { categoryService } from "@/services/category.service";
import { articleService } from "@/services/article.service";
import { seoService } from "@/services/seo.service";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { StoryCard } from "@/components/story/StoryCard";
import { StoryGrid } from "@/components/story/StoryGrid";
import { TrendingList } from "@/components/home/TrendingList";
import { Pagination } from "@/components/ui/Pagination";
import { AdSlot } from "@/components/ads/AdSlot";
import { EmptyState } from "@/components/ui/EmptyState";
import { JsonLd } from "@/components/seo/JsonLd";

const PAGE_SIZE = 13; // 1 featured + 12 grid on page 1

type Params = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

function categoryHref(slug: string, page: number): Route {
  return (page > 1 ? `/category/${slug}?page=${page}` : `/category/${slug}`) as Route;
}

export async function generateStaticParams() {
  const slugs = await categoryService.listSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: Params): Promise<Metadata> {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const category = await categoryService.getBySlug(slug);
  if (!category) return { title: "Category not found" };

  const page = Math.max(1, Number(pageParam) || 1);
  return seoService.buildMetadata({
    title: category.seoTitle ?? category.name,
    description: category.metaDescription ?? category.description ?? undefined,
    path: categoryHref(slug, page),
    robotsIndex: category.robotsIndex,
  });
}

export default async function CategoryPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const category = await categoryService.getBySlug(slug);
  if (!category) notFound();

  const page = Math.max(1, Number(pageParam) || 1);
  const { items, total, totalPages } = await articleService.listByCategory(
    slug,
    { page, pageSize: PAGE_SIZE },
  );
  if (total > 0 && page > totalPages) notFound();

  const featured = page === 1 ? items[0] : undefined;
  const gridItems = page === 1 ? items.slice(1) : items;
  const topViewed = await articleService.listTopViewedInCategory(
    category.id,
    4,
  );

  return (
    <>
      <JsonLd
        data={seoService.breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: category.name, path: `/category/${slug}` },
        ])}
      />

      <div className="site-container py-8 sm:py-10">
        <Breadcrumbs
          items={[{ name: "Home", href: "/" }, { name: category.name }]}
        />

        <header className="mt-4 max-w-2xl">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {category.name}
          </h1>
          {category.description && (
            <p className="text-muted mt-2 text-lg">{category.description}</p>
          )}
        </header>

        <AdSlot placement="top-leaderboard" className="mt-8" />

        {total === 0 ? (
          <EmptyState
            className="mt-10"
            title={`No stories in ${category.name} yet`}
            description="Check back soon — new stories are added regularly, or explore another category from the menu."
          />
        ) : (
          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-10">
              {featured && (
                <StoryCard
                  story={featured}
                  variant="overlay"
                  size="lg"
                  priority
                  sizes="(max-width: 1024px) 100vw, 66vw"
                  className="aspect-[16/9]"
                />
              )}

              <StoryGrid stories={gridItems} columns={2} />

              <Pagination
                page={page}
                totalPages={totalPages}
                buildHref={(p) => categoryHref(slug, p)}
                className="pt-4"
              />
            </div>

            <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
              <AdSlot placement="sidebar" />
              {topViewed.length > 0 && (
                <TrendingList stories={topViewed} title={`Most Read in ${category.name}`} />
              )}
            </aside>
          </div>
        )}

        <p className="text-muted mt-10 text-xs">
          {total} {total === 1 ? "story" : "stories"} in {category.name}
        </p>
      </div>
    </>
  );
}
