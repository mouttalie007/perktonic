import type { Metadata } from "next";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { articleService } from "@/services/article.service";
import { adService } from "@/services/ad.service";
import { seoService } from "@/services/seo.service";
import { processArticleHtml } from "@/lib/article-html";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ArticleHeader } from "@/components/article/ArticleHeader";
import { ArticleBody } from "@/components/article/ArticleBody";
import { ShareButtons } from "@/components/article/ShareButtons";
import { AuthorBox } from "@/components/article/AuthorBox";
import { RelatedStories } from "@/components/article/RelatedStories";
import { NewsletterCTA } from "@/components/home/NewsletterCTA";
import { AdSlot } from "@/components/ads/AdSlot";
import { JsonLd } from "@/components/seo/JsonLd";
import { DEFAULT_AUTHOR_NAME } from "@/config/site";

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const refs = await articleService.listAllPublishedRefs();
  return refs
    .filter((r) => r.type === "STANDARD")
    .map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const article = await articleService.getStandardBySlug(slug);
  if (!article) return { title: "Story not found" };

  return seoService.buildMetadata({
    title: article.seoTitle ?? article.title,
    description: article.metaDescription ?? article.excerpt ?? undefined,
    path: `/story/${article.slug}`,
    type: "article",
    ogImage: article.ogImage?.url ?? article.featuredImage?.url,
    robotsIndex: article.robotsIndex,
    publishedTime: article.publishedAt?.toISOString(),
    modifiedTime: article.updatedAt.toISOString(),
  });
}

export default async function StoryPage({ params }: Params) {
  const { slug } = await params;
  const article = await articleService.getStandardBySlug(slug);
  if (!article) notFound();

  const [related, adRule] = await Promise.all([
    articleService.listRelated(article.id, article.categoryId, 4),
    adService.getInContentRule("STANDARD"),
  ]);

  const { toc, segments } = processArticleHtml(article.content ?? "", {
    adEveryNParagraphs: adRule?.everyNParagraphs,
    maxAds: adRule?.maxInjections,
  });

  const path = `/story/${article.slug}`;
  const canonical = seoService.absoluteUrl(path);
  const authorName = article.author?.name ?? DEFAULT_AUTHOR_NAME;

  const crumbs = [
    { name: "Home", path: "/" },
    ...(article.category
      ? [
          {
            name: article.category.name,
            path: `/category/${article.category.slug}`,
          },
        ]
      : []),
    { name: article.title, path },
  ];

  const adCtx = {
    adsDisabled: article.adsDisabled,
    adOverrides: (article.adOverrides ?? null) as Record<
      string,
      string | null
    > | null,
  };

  return (
    <>
      <JsonLd
        data={await seoService.articleJsonLd({
          headline: article.title,
          description: article.metaDescription ?? article.excerpt ?? "",
          path,
          imageUrl: article.ogImage?.url ?? article.featuredImage?.url,
          datePublished: article.publishedAt?.toISOString(),
          dateModified: article.updatedAt.toISOString(),
          authorName,
          section: article.category?.name,
        })}
      />
      <JsonLd data={seoService.breadcrumbJsonLd(crumbs)} />

      <article className="site-container py-8 sm:py-10">
        <div className="mx-auto max-w-[var(--width-article)]">
          <Breadcrumbs
            items={crumbs.map((c, i) => ({
              name: c.name,
              href: i < crumbs.length - 1 ? (c.path as Route) : undefined,
            }))}
          />

          <ArticleHeader article={article} />

          <div className="mt-8">
            <ArticleBody segments={segments} toc={toc} adCtx={adCtx} />
          </div>

          <ShareButtons
            url={canonical}
            title={article.title}
            className="border-line mt-10 border-t pt-6"
          />

          <div className="mt-8">
            <AuthorBox author={article.author} />
          </div>

          <AdSlot placement="below-article" article={adCtx} className="mt-10" />
        </div>

        {related.length > 0 && (
          <div className="mx-auto mt-16 max-w-5xl">
            <RelatedStories stories={related} />
          </div>
        )}
      </article>

      <NewsletterCTA />
    </>
  );
}
