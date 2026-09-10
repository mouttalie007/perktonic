import type { ArticleCard } from "@/services/article.service";
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
}: {
  stories: ArticleCard[];
  columns?: 3 | 4;
  sizes?: string;
  className?: string;
}) {
  const lg = columns === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4";
  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${lg} ${className}`}>
      {stories.map((story) => (
        <StoryCard key={story.id} story={story} variant="grid" sizes={sizes} />
      ))}
    </div>
  );
}
