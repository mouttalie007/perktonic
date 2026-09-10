import type { ArticleCard } from "@/services/article.service";
import { StoryCard } from "@/components/story/StoryCard";

/**
 * Homepage hero (spec §9, §10): one large primary story + two supporting
 * stories. The primary image is the LCP element — it gets `priority` and is
 * never lazy-loaded.
 */
export function HeroSection({ stories }: { stories: ArticleCard[] }) {
  const [primary, ...rest] = stories;
  if (!primary) return null;
  const secondary = rest.slice(0, 2);

  return (
    <section aria-label="Top stories" className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
      <StoryCard
        story={primary}
        variant="overlay"
        size="lg"
        priority
        sizes="(max-width: 1024px) 100vw, 62vw"
        className="aspect-[16/11] sm:aspect-[16/9] lg:aspect-auto lg:h-full lg:min-h-[460px]"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        {secondary.map((s) => (
          <StoryCard
            key={s.id}
            story={s}
            variant="overlay"
            size="md"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 34vw"
            className="aspect-[16/10] lg:aspect-auto lg:min-h-[222px] lg:flex-1"
          />
        ))}
      </div>
    </section>
  );
}
