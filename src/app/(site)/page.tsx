import type { Metadata } from "next";
import type { Route } from "next";
import { articleService } from "@/services/article.service";
import { trendingService } from "@/services/trending.service";
import { categoryService } from "@/services/category.service";
import { siteSettingsService } from "@/services/site-settings.service";
import { seoService } from "@/services/seo.service";
import { reactionService } from "@/services/reaction.service";
import { commentService } from "@/services/comment.service";
import { TrendingRail } from "@/components/home/TrendingRail";
import { CategoryQuickNav } from "@/components/home/CategoryQuickNav";
import { NewsletterCTA } from "@/components/home/NewsletterCTA";
import { StoryCard } from "@/components/story/StoryCard";
import { Pagination } from "@/components/ui/Pagination";
import { AdSlot } from "@/components/ads/AdSlot";
import { QUICK_NAV_CATEGORIES } from "@/config/site";

const PAGE_SIZE = 12;

function homeHref(page: number): Route {
  return (page > 1 ? `/?page=${page}` : "/") as Route;
}

export async function generateMetadata(): Promise<Metadata> {
  const seo = await siteSettingsService.getSeoSettings();
  const meta = await seoService.buildMetadata({
    title: seo.defaultTitle,
    description: seo.defaultMetaDescription,
    path: "/",
  });
  // Home keeps its full title — the "%s — ViralTrendly" template must not apply.
  return { ...meta, title: { absolute: seo.defaultTitle } };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [trending, categories, feed] = await Promise.all([
    trendingService.list(10),
    categoryService.listAll(),
    articleService.listFeed({ page, pageSize: PAGE_SIZE }),
  ]);

  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const quickNav = QUICK_NAV_CATEGORIES.map((s) => bySlug.get(s)).filter(
    (c): c is (typeof categories)[number] => Boolean(c),
  );

  const engagementIds = [...trending.map((s) => s.id), ...feed.items.map((s) => s.id)];
  const [reactionsById, commentCountsById] = await Promise.all([
    reactionService.getCountsForArticles(engagementIds),
    commentService.countApprovedForArticles(engagementIds),
  ]);
  const engagementFor = (id: string) => ({
    reactions: reactionsById.get(id) ?? {},
    commentCount: commentCountsById.get(id) ?? 0,
  });
  const trendingEngagement = new Map(trending.map((s) => [s.id, engagementFor(s.id)]));

  const jsonLd = await seoService.organizationAndWebsiteJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="site-container space-y-10 py-6 sm:py-8">
        <AdSlot placement="top-leaderboard" />

        <TrendingRail stories={trending} engagement={trendingEngagement} />

        <CategoryQuickNav categories={quickNav} />

        <AdSlot placement="in-content" />

        {feed.total === 0 ? (
          <p className="text-muted py-10 text-center text-sm">
            No stories published yet — check back soon.
          </p>
        ) : (
          <section aria-label="Latest stories" className="divide-line divide-y">
            {feed.items.map((story) => {
              const eng = engagementFor(story.id);
              return (
                <StoryCard
                  key={story.id}
                  story={story}
                  variant="feed"
                  reactions={eng.reactions}
                  commentCount={eng.commentCount}
                />
              );
            })}
          </section>
        )}

        <Pagination page={page} totalPages={feed.totalPages} buildHref={homeHref} />
      </div>

      <NewsletterCTA />
    </>
  );
}
