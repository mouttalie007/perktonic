import type { Metadata } from "next";
import { CATEGORIES } from "@/config/site";
import { articleService } from "@/services/article.service";
import { siteSettingsService } from "@/services/site-settings.service";
import { seoService } from "@/services/seo.service";
import { HomeHero } from "@/components/home/HomeHero";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { PopularTools } from "@/components/home/PopularTools";
import { LatestGuides } from "@/components/home/LatestGuides";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await siteSettingsService.getSeoSettings();
  const meta = await seoService.buildMetadata({
    title: seo.defaultTitle,
    description: seo.defaultMetaDescription,
    path: "/",
  });
  // Home keeps its full title: the "%s — PerkTonic" template must not apply.
  return { ...meta, title: { absolute: seo.defaultTitle } };
}

/** Homepage (2026-10-29 redesign): hero, tool categories, popular tools, latest guides. */
export default async function HomePage() {
  const [latest, jsonLd] = await Promise.all([
    articleService.listLatestPerCategory(CATEGORIES.map((c) => c.slug)),
    seoService.organizationAndWebsiteJsonLd(),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeHero />
      <CategoryGrid />
      <PopularTools />
      <LatestGuides articles={latest} />
    </>
  );
}
