import type { Metadata } from "next";
import { articleService } from "@/services/article.service";
import { trendingService } from "@/services/trending.service";
import { categoryService } from "@/services/category.service";
import { siteSettingsService } from "@/services/site-settings.service";
import { seoService } from "@/services/seo.service";
import { HeroSection } from "@/components/home/HeroSection";
import { TrendingList } from "@/components/home/TrendingList";
import { CategoryQuickNav } from "@/components/home/CategoryQuickNav";
import { PopularCategories } from "@/components/home/PopularCategories";
import { NewsletterCTA } from "@/components/home/NewsletterCTA";
import { StoryGrid } from "@/components/story/StoryGrid";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AdSlot } from "@/components/ads/AdSlot";
import { POPULAR_CATEGORIES, QUICK_NAV_CATEGORIES } from "@/config/site";

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

export default async function HomePage() {
  const [featured, trending, categories, latestRaw] = await Promise.all([
    articleService.listFeatured(3),
    trendingService.list(5),
    categoryService.listAll(),
    articleService.listLatest({ limit: 12 }),
  ]);

  const featuredIds = new Set(featured.map((s) => s.id));
  const latest = latestRaw.filter((s) => !featuredIds.has(s.id)).slice(0, 6);

  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const quickNav = QUICK_NAV_CATEGORIES.map((s) => bySlug.get(s)).filter(
    (c): c is (typeof categories)[number] => Boolean(c),
  );
  const popular = POPULAR_CATEGORIES.map((s) => bySlug.get(s)).filter(
    (c): c is (typeof categories)[number] => Boolean(c),
  );

  const jsonLd = await seoService.organizationAndWebsiteJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="site-container space-y-12 py-6 sm:py-8">
        <AdSlot placement="top-leaderboard" />

        <HeroSection stories={featured} />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-12">
            <CategoryQuickNav categories={quickNav} />

            <section>
              <SectionHeading title="Latest Stories" />
              <StoryGrid
                stories={latest}
                columns={3}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 30vw"
              />
            </section>

            <AdSlot placement="in-content" />

            <TrendingList stories={trending} className="lg:hidden" />
          </div>

          <aside className="hidden space-y-6 lg:block">
            <AdSlot placement="sidebar" />
            <TrendingList stories={trending} className="lg:sticky lg:top-6" />
          </aside>
        </div>

        <section>
          <SectionHeading title="Popular Categories" as="h2" />
          <PopularCategories categories={popular} />
        </section>
      </div>

      <NewsletterCTA />
    </>
  );
}
