import type { Metadata } from "next";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { articleService } from "@/services/article.service";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { StoryGrid } from "@/components/story/StoryGrid";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";

const PAGE_SIZE = 12;

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Guides, tutorials and best practices to get more from your spreadsheets, data and workflows.",
  alternates: { canonical: "/blog" },
};

const blogHref = (page: number) =>
  (page > 1 ? `/blog?page=${page}` : "/blog") as Route;

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const feed = await articleService.listFeed({ page, pageSize: PAGE_SIZE });
  if (feed.total > 0 && page > feed.totalPages) notFound();

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
      {feed.total === 0 ? (
        <EmptyState
          className="mt-10"
          title="No articles yet"
          description="New guides are on the way."
        />
      ) : (
        <div className="mt-10 space-y-10">
          <StoryGrid stories={feed.items} columns={3} />
          <Pagination
            page={page}
            totalPages={feed.totalPages}
            buildHref={blogHref}
          />
        </div>
      )}
    </div>
  );
}
