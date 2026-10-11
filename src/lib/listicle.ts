import type { Route } from "next";
import { resolveOgImage } from "./resolve-og-image";

/**
 * Shared logic for Top-N listicle articles (spec §4, discussion notes):
 * each item is its own real subpage at /story/{slug}/{n}. Page 1 is the base
 * route /story/{slug} and also shows the first item. /story/{slug}/all is a
 * secondary single-page view.
 */

/** Editors should aim for at least this many characters per item description
 *  so subpages carry real content (enforced in the Phase 7 editor). */
export const LISTICLE_MIN_ITEM_DESCRIPTION = 180;

export type ListicleItemLike = {
  position: number;
  heading: string | null;
  description: string;
  credit: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  media: {
    url: string;
    ogUrl?: string | null;
    alt: string | null;
    credit: string | null;
    width: number | null;
    height: number | null;
  } | null;
};

export function itemImage(item: ListicleItemLike) {
  return {
    url: item.media?.url ?? item.imageUrl ?? null,
    ogUrl: item.media?.ogUrl ?? null,
    alt: item.media?.alt ?? item.imageAlt ?? item.heading ?? "",
    credit: item.media?.credit ?? item.credit ?? null,
    width: item.media?.width ?? null,
    height: item.media?.height ?? null,
  };
}

/** 1-based; page 1 lives at the bare slug, pages 2..N at /{n}. */
export function subpagePath(slug: string, position: number): Route {
  return (position <= 1
    ? `/story/${slug}`
    : `/story/${slug}/${position}`) as Route;
}

export function allViewPath(slug: string): Route {
  return `/story/${slug}/all` as Route;
}

export interface SubpageMeta {
  position: number;
  total: number;
  title: string;
  description: string;
  canonicalPath: string;
  ogImageUrl: string | null;
  prevPath: Route | null;
  nextPath: Route | null;
  robotsIndex: boolean;
}

export function buildSubpageMeta(
  article: {
    slug: string;
    title: string;
    seoTitle: string | null;
    metaDescription: string | null;
    excerpt: string | null;
    intro: string | null;
    robotsIndex: boolean;
    listicleIndexSubpages: boolean;
    featuredImage: { url: string; ogUrl?: string | null } | null;
    ogImage: { url: string; ogUrl?: string | null } | null;
  },
  items: ListicleItemLike[],
  position: number,
): SubpageMeta {
  const total = items.length;
  const item = items[position - 1];
  const isFirst = position === 1;
  const firstItemImg = item ? itemImage(item) : null;
  const itemImgCandidate = firstItemImg?.url ? { url: firstItemImg.url, ogUrl: firstItemImg.ogUrl } : null;

  const title = isFirst
    ? (article.seoTitle ?? article.title)
    : `${item?.heading ?? `Part ${position}`} — ${article.title} (${position}/${total})`;

  const description = isFirst
    ? (article.metaDescription ??
      article.excerpt ??
      article.intro?.slice(0, 160) ??
      article.title)
    : (item?.description?.slice(0, 160) ?? article.title);

  const ogImageUrl = isFirst
    ? (resolveOgImage(article.ogImage, article.featuredImage, itemImgCandidate) ?? null)
    : (resolveOgImage(itemImgCandidate, article.featuredImage) ?? null);

  return {
    position,
    total,
    title,
    description,
    canonicalPath: subpagePath(article.slug, position),
    ogImageUrl,
    prevPath: position > 1 ? subpagePath(article.slug, position - 1) : null,
    nextPath: position < total ? subpagePath(article.slug, position + 1) : null,
    // First page follows the article's own flag; deeper subpages also need the
    // per-article "index subpages" switch to be on.
    robotsIndex: isFirst
      ? article.robotsIndex
      : article.robotsIndex && article.listicleIndexSubpages,
  };
}
