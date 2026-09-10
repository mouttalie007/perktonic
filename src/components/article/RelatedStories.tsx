import type { ArticleCard } from "@/services/article.service";
import { StoryCard } from "@/components/story/StoryCard";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * "You May Also Like" (spec §28). 3–4 related stories at the end of an article.
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stories.slice(0, 4).map((story) => (
          <StoryCard
            key={story.id}
            story={story}
            variant="grid"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ))}
      </div>
    </section>
  );
}
