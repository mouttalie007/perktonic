import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { articleService } from "@/services/article.service";
import { adService } from "@/services/ad.service";
import { seoService } from "@/services/seo.service";
import { quizService } from "@/services/quiz.service";
import { processArticleHtml } from "@/lib/article-html";
import { buildSubpageMeta } from "@/lib/listicle";
import { StandardArticleView } from "@/components/article/StandardArticleView";
import { ListicleView } from "@/components/listicle/ListicleView";
import { JsonLd } from "@/components/seo/JsonLd";
import { DEFAULT_AUTHOR_NAME } from "@/config/site";

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const refs = await articleService.listAllPublishedRefs();
  return refs.map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const article = await articleService.getForRender(slug);
  if (!article) return { title: "Story not found" };

  if (article.type === "LISTICLE") {
    const meta = buildSubpageMeta(article, article.listicleItems, 1);
    return seoService.buildMetadata({
      title: meta.title,
      description: meta.description,
      path: meta.canonicalPath,
      type: "article",
      ogImage: meta.ogImageUrl ?? undefined,
      robotsIndex: meta.robotsIndex,
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
    });
  }

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
  const article = await articleService.getForRender(slug);
  if (!article) notFound();

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

  const [related, otherCategory, adRule, quiz] = await Promise.all([
    articleService.listRelated(article.id, article.categoryId, 4),
    articleService.listFromOtherCategories(article.categoryId, article.id, 4),
    adService.getInContentRule(article.type),
    quizService.getSummaryForArticle(article.id),
  ]);

  // ---- Listicle: page 1 (intro + first item) ----
  if (article.type === "LISTICLE") {
    const meta = buildSubpageMeta(article, article.listicleItems, 1);
    return (
      <>
        {meta.nextPath && (
          <link rel="next" href={seoService.absoluteUrl(meta.nextPath)} />
        )}
        <JsonLd
          data={await seoService.articleJsonLd({
            headline: article.title,
            description: meta.description,
            path,
            imageUrl: meta.ogImageUrl ?? undefined,
            datePublished: article.publishedAt?.toISOString(),
            dateModified: article.updatedAt.toISOString(),
            authorName,
            section: article.category?.name,
          })}
        />
        <JsonLd data={seoService.breadcrumbJsonLd(crumbs)} />
        <ListicleView
          article={article}
          items={article.listicleItems}
          position={1}
          canonical={canonical}
          related={related}
          otherCategory={otherCategory}
          quiz={quiz}
        />
      </>
    );
  }

  // ---- Standard article ----
  const { toc, segments } = processArticleHtml(article.content ?? "", {
    adEveryNParagraphs: adRule?.everyNParagraphs,
    maxAds: adRule?.maxInjections,
  });

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
      <StandardArticleView
        article={article}
        segments={segments}
        toc={toc}
        canonical={canonical}
        related={related}
        otherCategory={otherCategory}
        quiz={quiz}
      />
    </>
  );
}
