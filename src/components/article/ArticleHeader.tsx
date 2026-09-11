import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import { formatDateLong, isDifferentDay, formatReadingTime } from "@/lib/format";
import { DEFAULT_AUTHOR_NAME } from "@/config/site";

type HeaderArticle = {
  title: string;
  excerpt: string | null;
  publishedAt: Date | null;
  updatedAt: Date;
  readingTime: number;
  category: { slug: string; name: string } | null;
  author: { name: string } | null;
  featuredImage: {
    url: string;
    alt: string | null;
    width: number | null;
    height: number | null;
    caption: string | null;
    credit: string | null;
  } | null;
};

/**
 * Article header (spec §25, §26, §72): category, H1, dek, byline + dates +
 * reading time, featured image with caption/credit.
 */
export function ArticleHeader({ article }: { article: HeaderArticle }) {
  const authorName = article.author?.name ?? DEFAULT_AUTHOR_NAME;
  const showUpdated = isDifferentDay(article.updatedAt, article.publishedAt);

  return (
    <header>
      {article.category && (
        <Link
          href={`/category/${article.category.slug}` as Route}
          className="bg-brand text-ink inline-block rounded-sm px-2.5 py-1 text-[0.7rem] font-extrabold tracking-wider uppercase"
        >
          {article.category.name}
        </Link>
      )}

      <h1 className="mt-4 text-[2rem] leading-[1.15] font-extrabold tracking-tight sm:text-[2.6rem]">
        {article.title}
      </h1>

      {article.excerpt && (
        <p className="text-muted mt-4 text-lg leading-relaxed sm:text-xl">
          {article.excerpt}
        </p>
      )}

      <div className="text-muted mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.82rem]">
        <span className="text-ink font-semibold">{authorName}</span>
        <span aria-hidden>·</span>
        {article.publishedAt && (
          <time dateTime={article.publishedAt.toISOString()}>
            {formatDateLong(article.publishedAt)}
          </time>
        )}
        <span aria-hidden>·</span>
        <span>{formatReadingTime(article.readingTime)}</span>
        {showUpdated && (
          <>
            <span aria-hidden>·</span>
            <span>Updated {formatDateLong(article.updatedAt)}</span>
          </>
        )}
      </div>

      {article.featuredImage?.url && (
        <figure className="mt-7">
          <div className="relative aspect-[16/9] overflow-hidden rounded-md">
            <Image
              src={article.featuredImage.url}
              alt={article.featuredImage.alt || article.title}
              fill
              // `priority` alone no longer sets fetchPriority on Next 16 —
              // see StoryCard.tsx's Picture() for the full note.
              fetchPriority="high"
              loading="eager"
              sizes="(max-width: 800px) 100vw, 744px"
              className="object-cover"
            />
          </div>
          {(article.featuredImage.caption || article.featuredImage.credit) && (
            <figcaption className="text-muted mt-2 text-[0.8rem]">
              {article.featuredImage.caption}
              {article.featuredImage.caption && article.featuredImage.credit && " "}
              {article.featuredImage.credit && (
                <span className="italic">({article.featuredImage.credit})</span>
              )}
            </figcaption>
          )}
        </figure>
      )}
    </header>
  );
}
