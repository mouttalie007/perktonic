import Link from "next/link";
import type { Route } from "next";
import type { ArticleCard } from "@/services/article.service";
import { StoryCard } from "@/components/story/StoryCard";
import { FlameIcon, ArrowRightIcon } from "@/components/icons";

/**
 * Trending Now module (spec §12). Numbered, editorial — not a social feed.
 * On mobile the homepage renders this below the primary content.
 */
export function TrendingList({
  stories,
  seeAllHref,
  className = "",
}: {
  stories: ArticleCard[];
  seeAllHref?: Route;
  className?: string;
}) {
  if (stories.length === 0) return null;

  return (
    <section
      aria-label="Trending now"
      className={`border-line bg-canvas rounded-sm border p-4 ${className}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-extrabold tracking-[0.12em] uppercase">
          <FlameIcon width={18} height={18} className="text-accent-red" />
          Trending Now
        </h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="text-muted hover:text-ink group inline-flex items-center gap-1 text-xs font-semibold transition-colors"
          >
            See All
            <ArrowRightIcon
              width={13}
              height={13}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        )}
      </div>

      <ol className="divide-line divide-y">
        {stories.map((story, i) => (
          <li key={story.id} className="py-3 first:pt-0 last:pb-0">
            <StoryCard story={story} variant="list" rank={i + 1} />
          </li>
        ))}
      </ol>
    </section>
  );
}
