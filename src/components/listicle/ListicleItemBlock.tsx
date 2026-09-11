import type { ReactNode } from "react";
import Image from "next/image";
import { itemImage, type ListicleItemLike } from "@/lib/listicle";

/**
 * One listicle entry: heading, image (with credit), description.
 * Used both on a dedicated subpage and stacked in the /all view.
 */
export function ListicleItemBlock({
  item,
  total,
  headingLevel = "h2",
  priority = false,
  midSlot,
}: {
  item: ListicleItemLike;
  total: number;
  headingLevel?: "h1" | "h2";
  priority?: boolean;
  /** Rendered between the image and the description (the between-slides ad). */
  midSlot?: ReactNode;
}) {
  const img = itemImage(item);
  const Heading = headingLevel;

  return (
    <section aria-label={item.heading ?? `Item ${item.position}`}>
      <p className="text-brand-ink text-sm font-extrabold tracking-wider">
        {item.position} <span className="text-muted">/ {total}</span>
      </p>
      {item.heading && (
        <Heading
          className={`mt-1 font-extrabold tracking-tight ${
            headingLevel === "h1"
              ? "text-[1.9rem] leading-[1.15] sm:text-[2.4rem]"
              : "text-2xl leading-tight sm:text-[1.75rem]"
          }`}
        >
          {item.heading}
        </Heading>
      )}

      {img.url && (
        <figure className="mt-5">
          <div className="relative aspect-[16/10] overflow-hidden rounded-md">
            <Image
              src={img.url}
              alt={img.alt}
              fill
              // `priority` alone no longer sets fetchPriority on Next 16 —
              // see StoryCard.tsx's Picture() for the full note.
              fetchPriority={priority ? "high" : undefined}
              loading={priority ? "eager" : "lazy"}
              sizes="(max-width: 800px) 100vw, 744px"
              className="object-cover"
            />
          </div>
          {img.credit && (
            <figcaption className="text-muted mt-2 text-[0.8rem] italic">
              {img.credit}
            </figcaption>
          )}
        </figure>
      )}

      {midSlot}

      <div className="article-prose mt-5">
        {item.description
          .split(/\n{2,}/)
          .map((para, i) => <p key={i}>{para.trim()}</p>)}
      </div>
    </section>
  );
}
