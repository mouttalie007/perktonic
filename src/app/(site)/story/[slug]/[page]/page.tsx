import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { articleService } from "@/services/article.service";
import { seoService } from "@/services/seo.service";
import { buildSubpageMeta, subpagePath } from "@/lib/listicle";
import { ListicleView } from "@/components/listicle/ListicleView";
import { ListicleAllView } from "@/components/listicle/ListicleAllView";
import { JsonLd } from "@/components/seo/JsonLd";
import { DEFAULT_AUTHOR_NAME } from "@/config/site";

type Params = { params: Promise<{ slug: string; page: string }> };

export async function generateStaticParams() {
  const refs = await articleService.listListicleRefs();
  return refs.flatMap((r) => {
    const n = r._count.listicleItems;
    const positions = Array.from({ length: Math.max(0, n - 1) }, (_, i) => ({
      slug: r.slug,
      page: String(i + 2),
    }));
    return [...positions, { slug: r.slug, page: "all" }];
  });
}

/** null = not found, "all" = single-page view, number = 1-based item position. */
function parsePage(raw: string, total: number): number | "all" | null {
  if (raw === "all") return "all";
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  // Page 1 lives at the bare slug — /2..N here.
  return n >= 2 && n <= total ? n : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, page } = await params;
  const article = await articleService.getForRender(slug);
  if (!article || article.type !== "LISTICLE") return { title: "Not found" };

  const items = article.listicleItems;
  const parsed = parsePage(page, items.length);
  if (parsed === null) return { title: "Not found" };

  if (parsed === "all") {
    // Consolidate the /all view onto page 1 — it's a duplicate of the series.
    return seoService.buildMetadata({
      title: `${article.seoTitle ?? article.title} — Full list`,
      description:
        article.metaDescription ?? article.excerpt ?? article.title,
      path: subpagePath(article.slug, 1),
      type: "article",
      ogImage: article.ogImage?.url ?? article.featuredImage?.url,
      robotsIndex: false,
      modifiedTime: article.updatedAt.toISOString(),
    });
  }

  const meta = buildSubpageMeta(article, items, parsed);
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

export default async function ListicleSubpage({ params }: Params) {
  const { slug, page } = await params;
  const article = await articleService.getForRender(slug);
  if (!article || article.type !== "LISTICLE") notFound();

  const items = article.listicleItems;
  const parsed = parsePage(page, items.length);
  if (parsed === null) notFound();

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
    { name: article.title, path: subpagePath(article.slug, 1) },
  ];

  // ---- /all ----
  if (parsed === "all") {
    const [related, otherCategory] = await Promise.all([
      articleService.listRelated(article.id, article.categoryId, 4),
      articleService.listFromOtherCategories(article.categoryId, article.id, 4),
    ]);
    const canonical = seoService.absoluteUrl(subpagePath(article.slug, 1));
    return (
      <>
        <JsonLd data={seoService.breadcrumbJsonLd(crumbs)} />
        <ListicleAllView
          article={article}
          items={items}
          canonical={canonical}
          related={related}
          otherCategory={otherCategory}
        />
      </>
    );
  }

  // ---- item position 2..N ----
  const meta = buildSubpageMeta(article, items, parsed);
  const canonical = seoService.absoluteUrl(meta.canonicalPath);
  const isLast = parsed === items.length;
  const [related, otherCategory] = isLast
    ? await Promise.all([
        articleService.listRelated(article.id, article.categoryId, 4),
        articleService.listFromOtherCategories(article.categoryId, article.id, 4),
      ])
    : [[], []];

  return (
    <>
      {meta.prevPath && (
        <link rel="prev" href={seoService.absoluteUrl(meta.prevPath)} />
      )}
      {meta.nextPath && (
        <link rel="next" href={seoService.absoluteUrl(meta.nextPath)} />
      )}
      <JsonLd
        data={await seoService.articleJsonLd({
          headline: `${items[parsed - 1]?.heading ?? article.title}`,
          description: meta.description,
          path: meta.canonicalPath,
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
        items={items}
        position={parsed}
        canonical={canonical}
        related={related}
        otherCategory={otherCategory}
      />
    </>
  );
}
