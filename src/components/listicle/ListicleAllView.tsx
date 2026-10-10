import Link from "next/link";
import type { Route } from "next";
import type { ArticleCard } from "@/services/article.service";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { ShareButtons } from "@/components/article/ShareButtons";
import { AuthorBox } from "@/components/article/AuthorBox";
import { ReactionBar } from "@/components/article/ReactionBar";
import { CommentSection } from "@/components/article/CommentSection";
import { NewsletterSidebarCTA } from "@/components/article/NewsletterSidebarCTA";
import { AdSlot } from "@/components/ads/AdSlot";
import { TrendingList } from "@/components/home/TrendingList";
import { reactionService } from "@/services/reaction.service";
import { formatDateLong, formatReadingTime } from "@/lib/format";
import { DEFAULT_AUTHOR_NAME } from "@/config/site";
import { subpagePath, type ListicleItemLike } from "@/lib/listicle";
import { ListicleItemBlock } from "./ListicleItemBlock";

type AllArticle = {
  id: string;
  slug: string;
  title: string;
  intro: string | null;
  publishedAt: Date | null;
  readingTime: number;
  adsDisabled: boolean;
  adOverrides: unknown;
  category: { slug: string; name: string } | null;
  author: {
    slug: string;
    name: string;
    role: string | null;
    bio: string | null;
    avatarUrl: string | null;
  } | null;
};

/**
 * Single-page view of a whole listicle (spec §4 — the secondary "/all" route).
 * Its canonical points back to page 1 so it doesn't compete for indexing.
 */
export async function ListicleAllView({
  article,
  items,
  canonical,
  related,
  otherCategory,
}: {
  article: AllArticle;
  items: ListicleItemLike[];
  canonical: string;
  related: ArticleCard[];
  otherCategory: ArticleCard[];
}) {
  const reactionCounts = await reactionService.getCounts(article.id);
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
    <article className="site-container py-8 sm:py-10">
      {/* Drops the current page from the visible trail — see StandardArticleView. */}
      <Breadcrumbs items={crumbs.slice(0, -1)} />

      <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 max-w-[var(--width-article)]">
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
            </div>
            <p className="mt-3 text-[0.8rem]">
              <Link
                href={subpagePath(article.slug, 1)}
                className="text-accent-blue font-semibold hover:underline"
              >
                ← Read one item at a time
              </Link>
            </p>
            {article.intro && (
              <div className="article-prose mt-6">
                {article.intro
                  .split(/\n{2,}/)
                  .map((p, i) => <p key={i}>{p.trim()}</p>)}
              </div>
            )}
          </header>

          <AdSlot placement="under-title" article={adCtx} className="my-8" />

          <div className="mt-8 space-y-14">
            {items.map((item, i) => (
              <ListicleItemBlock
                key={item.position}
                item={item}
                total={items.length}
                headingLevel="h2"
                priority={i === 0}
              />
            ))}
          </div>

          <div className="border-line mt-12 flex flex-wrap items-center justify-between gap-4 border-t pt-6">
            <ReactionBar articleId={article.id} initialCounts={reactionCounts} />
            <ShareButtons url={canonical} title={article.title} />
          </div>
          <div className="mt-8">
            <AuthorBox author={article.author} />
          </div>
          <AdSlot
            placement="below-article"
            article={adCtx}
            className="mt-10"
          />

          <CommentSection
            articleId={article.id}
            path={subpagePath(article.slug, 1)}
            className="mt-12"
          />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <AdSlot placement="sidebar" />
          {related.length > 0 && <TrendingList stories={related} title="More Good Stuff" />}
          {otherCategory.length > 0 && (
            <TrendingList stories={otherCategory} title="Popular Elsewhere" />
          )}
          <NewsletterSidebarCTA />
        </aside>
      </div>
    </article>
  );
}
