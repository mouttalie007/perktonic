import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import type { ArticleCard } from "@/services/article.service";
import { formatDate, formatViews, isoDate } from "@/lib/format";
import { EngagementMeta } from "@/components/article/EngagementMeta";
import type { ReactionCounts } from "@/services/reaction.service";

/**
 * The reusable story card (spec §14, §15, §65). One component, five shapes:
 *  - `grid`    image-top card for grids (category pages)
 *  - `overlay` full-bleed image with text over a bottom gradient (hero)
 *  - `list`    thumb + text row, optional rank number (Trending)
 *  - `compact` small thumb + title only, no meta/badge — end-of-article
 *              "You May Also Like" rows
 *  - `feed`    category label + thumb + title + engagement row — the main
 *              homepage feed (homepage redesign, 2026-09-12)
 *
 * All images use a fixed aspect ratio + object-cover and reserve space to
 * avoid CLS. Only pass `priority` for the single above-the-fold hero image.
 */

type Variant = "grid" | "overlay" | "list" | "compact" | "feed";

interface Props {
  story: ArticleCard;
  variant?: Variant;
  size?: "lg" | "md";
  rank?: number;
  priority?: boolean;
  sizes?: string;
  headingClassName?: string;
  className?: string;
  /** `feed` variant only — engagement preview, batch-fetched by the caller. */
  reactions?: ReactionCounts;
  commentCount?: number;
}

function storyHref(slug: string): Route {
  return `/story/${slug}` as Route;
}

function Badge({ story }: { story: ArticleCard }) {
  if (story.isBreaking) {
    return (
      <span className="bg-accent-red inline-block rounded-sm px-2 py-1 text-[0.65rem] font-extrabold tracking-wider text-white uppercase">
        Breaking
      </span>
    );
  }
  if (!story.category) return null;
  return (
    <span className="bg-brand text-ink inline-block rounded-sm px-2 py-1 text-[0.65rem] font-extrabold tracking-wider uppercase">
      {story.category.name}
    </span>
  );
}

function Meta({
  story,
  tone = "muted",
}: {
  story: ArticleCard;
  tone?: "muted" | "light";
}) {
  const cls = tone === "light" ? "text-white/75" : "text-muted";
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] ${cls}`}>
      {story.publishedAt && (
        <time dateTime={isoDate(story.publishedAt)}>
          {formatDate(story.publishedAt)}
        </time>
      )}
      {story.viewCount > 0 && (
        <>
          <span aria-hidden>·</span>
          <span>{formatViews(story.viewCount)}</span>
        </>
      )}
      {story.readingTime > 0 && (
        <>
          <span aria-hidden>·</span>
          <span>{story.readingTime} min read</span>
        </>
      )}
    </p>
  );
}

function Picture({
  story,
  sizes,
  priority,
  className = "",
}: {
  story: ArticleCard;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const img = story.featuredImage;
  if (!img?.url) {
    return (
      <div
        className={`from-ink to-ink-deep flex items-center justify-center bg-gradient-to-br ${className}`}
      >
        <span className="text-brand text-lg font-extrabold tracking-tight">
          {story.category?.name ?? "ViralTrendly"}
        </span>
      </div>
    );
  }
  return (
    <Image
      src={img.url}
      alt={img.alt || story.title}
      fill
      sizes={sizes}
      // Next 16 deprecated `priority` in favour of explicit `fetchPriority`
      // + `loading` (see node_modules/next/dist/docs .../components/image.md
      // #preload) — `priority` alone stopped setting fetchPriority="high" on
      // the <img>, only inserting the <link rel=preload>, which left the LCP
      // image's actual fetch un-prioritised (found via scripts/perf-audit.mjs).
      fetchPriority={priority ? "high" : undefined}
      loading={priority ? "eager" : "lazy"}
      className={`object-cover transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-[1.03] ${className}`}
    />
  );
}

export function StoryCard({
  story,
  variant = "grid",
  size = "md",
  rank,
  priority,
  sizes,
  headingClassName,
  className = "",
  reactions,
  commentCount,
}: Props) {
  const href = storyHref(story.slug);

  /* ---------- list (trending) ---------- */
  if (variant === "list") {
    return (
      <Link
        href={href}
        className={`group flex items-start gap-3 ${className}`}
      >
        {/* text-muted, not text-line (#e5e5e5 ~1.25:1 on white) — that was a
            real WCAG failure axe flagged as needing review (short-text
            numerals get "incomplete" rather than a hard violation). */}
        {rank != null && (
          <span className="text-muted w-6 shrink-0 text-2xl leading-none font-extrabold tabular-nums">
            {rank}
          </span>
        )}
        <span className="border-line relative aspect-square w-16 shrink-0 overflow-hidden rounded-sm border">
          <Picture
            story={story}
            sizes="64px"
            className="rounded-sm text-xs"
          />
        </span>
        <span className="min-w-0">
          <h3
            className={`text-ink group-hover:text-ink/70 line-clamp-3 text-[0.86rem] leading-snug font-bold transition-colors ${headingClassName ?? ""}`}
          >
            {story.title}
          </h3>
          {story.viewCount > 0 && (
            <span className="text-muted mt-1 block text-[0.72rem]">
              {formatViews(story.viewCount)}
            </span>
          )}
        </span>
      </Link>
    );
  }

  /* ---------- overlay (hero) ---------- */
  if (variant === "overlay") {
    return (
      <Link
        href={href}
        className={`group relative block overflow-hidden rounded-md ${className}`}
      >
        <Picture
          story={story}
          sizes={sizes ?? "(max-width: 1024px) 100vw, 60vw"}
          priority={priority}
          className=""
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
        <div
          className={`absolute inset-x-0 bottom-0 ${size === "lg" ? "p-6 sm:p-7" : "p-4 sm:p-5"}`}
        >
          <Badge story={story} />
          <h2
            className={`mt-2 font-extrabold tracking-tight text-white ${
              size === "lg"
                ? "text-2xl leading-[1.15] sm:text-3xl lg:text-[2.4rem]"
                : "text-lg leading-snug sm:text-xl"
            } ${headingClassName ?? ""}`}
          >
            <span className="line-clamp-3">{story.title}</span>
          </h2>
          {size === "lg" && story.excerpt && (
            <p className="mt-2 line-clamp-2 max-w-2xl text-sm text-white/80">
              {story.excerpt}
            </p>
          )}
          <div className="mt-3">
            <Meta story={story} tone="light" />
          </div>
        </div>
      </Link>
    );
  }

  /* ---------- compact (small, elegant — end-of-article) ---------- */
  if (variant === "compact") {
    return (
      <Link href={href} className={`group flex items-center gap-2.5 ${className}`}>
        <span className="bg-surface relative aspect-square w-14 shrink-0 overflow-hidden rounded-sm">
          <Picture story={story} sizes="56px" />
        </span>
        <span className="min-w-0">
          <h3 className="text-ink group-hover:text-ink/70 line-clamp-2 text-[0.82rem] leading-snug font-semibold transition-colors">
            {story.title}
          </h3>
        </span>
      </Link>
    );
  }

  /* ---------- feed (homepage main feed row) ---------- */
  if (variant === "feed") {
    return (
      <Link
        href={href}
        className={`group flex items-stretch gap-4 py-5 ${className}`}
      >
        {story.category && (
          <span
            aria-hidden
            className="hidden shrink-0 items-center justify-center border-r border-[var(--color-line)] pr-3 text-[0.68rem] font-extrabold tracking-[0.15em] uppercase [writing-mode:vertical-rl] sm:flex"
            style={{ color: story.category.accentColor ?? "var(--color-muted)" }}
          >
            <span className="rotate-180">{story.category.name}</span>
          </span>
        )}
        <span className="border-line relative aspect-[3/2] w-32 shrink-0 overflow-hidden rounded-sm border sm:w-44">
          <Picture story={story} sizes="(max-width: 640px) 128px, 176px" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          {story.category && (
            <span
              className="text-[0.7rem] font-bold tracking-wide uppercase sm:hidden"
              style={{ color: story.category.accentColor ?? "var(--color-muted)" }}
            >
              {story.category.name}
            </span>
          )}
          <h3
            className={`font-heading text-ink group-hover:text-ink/70 line-clamp-3 text-[1.05rem] leading-snug font-extrabold transition-colors sm:text-[1.15rem] ${headingClassName ?? ""}`}
          >
            {story.title}
          </h3>
          <EngagementMeta reactions={reactions ?? {}} commentCount={commentCount ?? 0} className="mt-1" />
        </span>
      </Link>
    );
  }

  /* ---------- grid (default) ---------- */
  return (
    <Link
      href={href}
      className={`group border-line bg-canvas flex flex-col overflow-hidden rounded-sm border transition-shadow hover:shadow-[var(--shadow-raised)] ${className}`}
    >
      <span className="relative block aspect-[16/10] overflow-hidden">
        <Picture
          story={story}
          sizes={sizes ?? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"}
        />
        <span className="absolute top-2 left-2">
          <Badge story={story} />
        </span>
      </span>
      <span className="flex flex-1 flex-col p-3">
        <h3
          className={`text-ink group-hover:text-ink/70 line-clamp-3 text-[0.98rem] leading-snug font-bold transition-colors ${headingClassName ?? ""}`}
        >
          {story.title}
        </h3>
        <span className="mt-auto pt-3">
          <Meta story={story} />
        </span>
      </span>
    </Link>
  );
}
