import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import type { ArticleCard } from "@/services/article.service";
import type { ReactionCounts } from "@/services/reaction.service";
import { EngagementMeta } from "@/components/article/EngagementMeta";

/**
 * Trending rail — top of the homepage (redesign, 2026-09-12). Horizontally
 * scrollable/swipeable, numbered, single image per card (see the schema
 * note on ArticleReaction/decision log: no diptych — one real featured
 * image per article). Replaces the old sidebar "Trending Now" list.
 */
export function TrendingRail({
  stories,
  engagement,
}: {
  stories: ArticleCard[];
  engagement: Map<string, { reactions: ReactionCounts; commentCount: number }>;
}) {
  if (stories.length === 0) return null;

  return (
    <section aria-label="Trending" className="-mx-4 px-4 sm:mx-0 sm:px-0">
      <h2 className="mb-4 flex items-center gap-3 text-xl font-extrabold tracking-tight sm:text-2xl">
        <span className="bg-brand inline-block h-6 w-1.5 rounded-full" aria-hidden />
        Trending
      </h2>
      <ul
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]"
        role="list"
      >
        {stories.map((story, i) => {
          const eng = engagement.get(story.id);
          const img = story.featuredImage;
          return (
            <li key={story.id} className="w-[62vw] shrink-0 snap-start sm:w-[280px]">
              <Link href={`/story/${story.slug}` as Route} className="group block">
                <span className="border-line relative block aspect-[3/2] overflow-hidden rounded-md border">
                  {img?.url ? (
                    <Image
                      src={img.url}
                      alt={img.alt || story.title}
                      fill
                      sizes="(max-width: 640px) 62vw, 280px"
                      loading={i === 0 ? "eager" : "lazy"}
                      fetchPriority={i === 0 ? "high" : undefined}
                      className="object-cover transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span className="from-ink to-ink-deep flex h-full w-full items-center justify-center bg-gradient-to-br">
                      <span className="text-brand-ink text-sm font-extrabold">
                        {story.category?.name ?? "ViralTrendly"}
                      </span>
                    </span>
                  )}
                  <span className="bg-ink absolute top-2 left-2 flex h-7 w-7 items-center justify-center rounded-sm text-sm font-extrabold text-white">
                    {i + 1}
                  </span>
                </span>
                <h3 className="font-heading group-hover:text-ink/70 mt-2.5 line-clamp-3 text-[0.98rem] leading-snug font-extrabold transition-colors">
                  {story.title}
                </h3>
                <EngagementMeta
                  reactions={eng?.reactions ?? {}}
                  commentCount={eng?.commentCount ?? 0}
                  className="mt-1.5"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
