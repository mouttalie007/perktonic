import type { Route } from "next";
import type { ArticleCard } from "@/services/article.service";
import type { TocItem } from "@/lib/article-html";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { ArticleHeader } from "./ArticleHeader";
import { ArticleBody } from "./ArticleBody";
import { ShareButtons } from "./ShareButtons";
import { AuthorBox } from "./AuthorBox";
import { ReactionBar } from "./ReactionBar";
import { CommentSection } from "./CommentSection";
import { NewsletterSidebarCTA } from "./NewsletterSidebarCTA";
import { AdSlot } from "@/components/ads/AdSlot";
import { TrendingList } from "@/components/home/TrendingList";
import { reactionService } from "@/services/reaction.service";

/* Loose shape — the article payload from articleService has all of this. */
type ViewArticle = Parameters<typeof ArticleHeader>[0]["article"] & {
  id: string;
  slug: string;
  content: string | null;
  adsDisabled: boolean;
  adOverrides: unknown;
  category: { slug: string; name: string } | null;
  author: Parameters<typeof AuthorBox>[0]["author"];
};

export async function StandardArticleView({
  article,
  segments,
  toc,
  canonical,
  related,
  otherCategory,
}: {
  article: ViewArticle;
  segments: string[];
  toc: TocItem[];
  canonical: string;
  related: ArticleCard[];
  otherCategory: ArticleCard[];
}) {
  const reactionCounts = await reactionService.getCounts(article.id);
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
      {/* Drops the current page from the visible trail (unlike the JSON-LD
          BreadcrumbList, which keeps it per schema.org convention) — the
          H1 right below already shows the full title, repeating it here
          read as noise rather than navigation. */}
      <Breadcrumbs items={crumbs.slice(0, -1)} />

      <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 max-w-[var(--width-article)]">
          <ArticleHeader article={article} />

          <div className="mt-8">
            <ArticleBody segments={segments} toc={toc} adCtx={adCtx} />
          </div>

          <div className="border-line mt-10 flex flex-wrap items-center justify-between gap-4 border-t pt-6">
            <ReactionBar articleId={article.id} initialCounts={reactionCounts} />
            <ShareButtons url={canonical} title={article.title} />
          </div>

          <div className="mt-8">
            <AuthorBox author={article.author} />
          </div>

          <AdSlot placement="below-article" article={adCtx} className="mt-10" />

          <CommentSection articleId={article.id} path={`/story/${article.slug}`} className="mt-12" />
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
