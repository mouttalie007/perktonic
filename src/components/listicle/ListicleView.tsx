import Link from "next/link";
import type { Route } from "next";
import type { ArticleCard } from "@/services/article.service";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { ShareButtons } from "@/components/article/ShareButtons";
import { AuthorBox } from "@/components/article/AuthorBox";
import { RelatedStories } from "@/components/article/RelatedStories";
import { ReactionBar } from "@/components/article/ReactionBar";
import { CommentSection } from "@/components/article/CommentSection";
import { NewsletterCTA } from "@/components/home/NewsletterCTA";
import { AdSlot } from "@/components/ads/AdSlot";
import { reactionService } from "@/services/reaction.service";
import { formatDateLong, formatReadingTime } from "@/lib/format";
import { DEFAULT_AUTHOR_NAME } from "@/config/site";
import {
  subpagePath,
  allViewPath,
  type ListicleItemLike,
} from "@/lib/listicle";
import { ListicleItemBlock } from "./ListicleItemBlock";
import { ListicleProgress } from "./ListicleProgress";
import { ListicleNav } from "./ListicleNav";

type ViewArticle = {
  id: string;
  slug: string;
  title: string;
  intro: string | null;
  excerpt: string | null;
  publishedAt: Date | null;
  readingTime: number;
  adsDisabled: boolean;
  adOverrides: unknown;
  category: { slug: string; name: string } | null;
  author: {
    name: string;
    role: string | null;
    bio: string | null;
    avatarUrl: string | null;
  } | null;
};

/** One listicle subpage (spec §4). Page 1 and the last page also carry the
 *  byline, author box, related stories and newsletter. */
export async function ListicleView({
  article,
  items,
  position,
  canonical,
  related,
}: {
  article: ViewArticle;
  items: ListicleItemLike[];
  position: number;
  canonical: string;
  related: ArticleCard[];
}) {
  const total = items.length;
  const item = items[position - 1];
  const isFirst = position === 1;
  const isLast = position === total;
  const showExtras = isFirst || isLast;
  // Reactions/comments only once the reader has reached the end — showing
  // the same thread on page 1 too would be a confusing duplicate.
  const reactionCounts = isLast ? await reactionService.getCounts(article.id) : {};
  const authorName = article.author?.name ?? DEFAULT_AUTHOR_NAME;

  const adCtx = {
    adsDisabled: article.adsDisabled,
    adOverrides: (article.adOverrides ?? null) as Record<
      string,
      string | null
    > | null,
  };

  const crumbs: Crumb[] = [
    { name: "Home", href: "/" as Route },
    ...(article.category
      ? [
          {
            name: article.category.name,
            href: `/category/${article.category.slug}` as Route,
          },
        ]
      : []),
    { name: article.title },
  ];

  return (
    <>
      <article className="site-container py-8 sm:py-10">
        <div className="mx-auto max-w-[var(--width-article)]">
          <Breadcrumbs items={crumbs} />

          {isFirst ? (
            <header className="mt-4">
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
                <span aria-hidden>·</span>
                <span>{total} items</span>
              </div>
              {article.intro && (
                <div className="article-prose mt-6">
                  {article.intro
                    .split(/\n{2,}/)
                    .map((p, i) => <p key={i}>{p.trim()}</p>)}
                </div>
              )}
            </header>
          ) : (
            <p className="text-muted mt-4 text-sm">
              From{" "}
              <Link
                href={subpagePath(article.slug, 1)}
                className="text-ink font-semibold hover:underline"
              >
                {article.title}
              </Link>
            </p>
          )}

          <AdSlot
            placement="under-title"
            article={adCtx}
            className="my-8"
          />

          {item && (
            <ListicleItemBlock
              item={item}
              total={total}
              headingLevel={isFirst ? "h2" : "h1"}
              priority
              midSlot={
                <AdSlot
                  placement="between-slides"
                  article={adCtx}
                  className="my-7"
                />
              }
            />
          )}

          <ListicleProgress
            position={position}
            total={total}
            className="mt-10"
          />
          <ListicleNav
            prevPath={
              position > 1 ? subpagePath(article.slug, position - 1) : null
            }
            nextPath={
              position < total ? subpagePath(article.slug, position + 1) : null
            }
            allPath={allViewPath(article.slug)}
            position={position}
            total={total}
            className="mt-4"
          />

          <div className="border-line mt-10 flex flex-wrap items-center justify-between gap-4 border-t pt-6">
            {isLast && <ReactionBar articleId={article.id} initialCounts={reactionCounts} />}
            <ShareButtons url={canonical} title={article.title} />
          </div>

          {showExtras && (
            <>
              <div className="mt-8">
                <AuthorBox author={article.author} />
              </div>
              <AdSlot
                placement="below-article"
                article={adCtx}
                className="mt-10"
              />
            </>
          )}

          {isLast && (
            <CommentSection
              articleId={article.id}
              path={subpagePath(article.slug, position)}
              className="mt-12"
            />
          )}
        </div>

        {showExtras && related.length > 0 && (
          <div className="mx-auto mt-16 max-w-5xl">
            <RelatedStories stories={related} />
          </div>
        )}
      </article>

      {showExtras && <NewsletterCTA />}
    </>
  );
}
