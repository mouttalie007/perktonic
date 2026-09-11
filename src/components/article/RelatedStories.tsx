import type { ArticleCard } from "@/services/article.service";
import { StoryCard } from "@/components/story/StoryCard";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * "You May Also Like" (spec §28) — small, elegant rows at the end of an
 * article, per feedback: image + title only, no metadata clutter.
 */
export function RelatedStories({
  stories,
  title = "You May Also Like",
}: {
  stories: ArticleCard[];
  title?: string;
}) {
  if (stories.length === 0) return null;
  return (
    <section aria-label={title}>
      <SectionHeading title={title} />
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        {stories.slice(0, 8).map((story) => (
          <StoryCard key={story.id} story={story} variant="compact" />
        ))}
      </div>
    </section>
  );
}
