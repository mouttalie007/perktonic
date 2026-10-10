import type { ArticleCard } from "@/services/article.service";
import type { ReactionCounts } from "@/services/reaction.service";
import { StoryCard } from "./StoryCard";

/**
 * Responsive grid of story cards (spec §14, §65).
 * 1 column mobile · 2 tablet · `columns` on desktop (default 4).
 */
export function StoryGrid({
  stories,
  columns = 4,
  sizes,
  className = "",
  engagementFor,
}: {
  stories: ArticleCard[];
  columns?: 2 | 3 | 4;
  sizes?: string;
  className?: string;
  /** Optional — shows reactions/comments instead of date/views/reading-time when given (homepage feed). */
  engagementFor?: (id: string) => { reactions: ReactionCounts; commentCount: number };
}) {
  const lg = columns === 2 ? "lg:grid-cols-2" : columns === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${lg} ${className}`}>
      {stories.map((story) => {
        const eng = engagementFor?.(story.id);
        return (
          <StoryCard
            key={story.id}
            story={story}
            variant="grid"
            sizes={sizes}
            reactions={eng?.reactions}
            commentCount={eng?.commentCount}
          />
        );
      })}
    </div>
  );
}
