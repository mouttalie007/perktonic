"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import type { ArticleCard } from "@/services/article.service";
import type { ReactionCounts } from "@/services/reaction.service";
import { EngagementMeta } from "@/components/article/EngagementMeta";
import { ArrowRightIcon } from "@/components/icons";

/**
 * Trending rail — top of the homepage (redesign, 2026-09-12). Horizontally
 * scrollable/swipeable, numbered, single image per card. Touch already
 * scrolls natively via CSS scroll-snap; this adds, on top of that
 * (2026-10-10):
 *  - Left/right arrow buttons (sm+ — mobile already has swipe, arrows are
 *    for mouse/trackpad users who don't).
 *  - Click-and-drag scrolling for mouse pointers specifically (`pointerType
 *    === "mouse"`) — touch/pen are left alone since the browser's native
 *    momentum scroll already handles those better than anything we'd
 *    hand-roll, and double-handling the same gesture fights itself.
 * A client component for exactly this interactivity; everything else about
 * it (data, markup) is unchanged from the original server component.
 */
export function TrendingRail({
  stories,
  engagement,
}: {
  stories: ArticleCard[];
  engagement: Map<string, { reactions: ReactionCounts; commentCount: number }>;
}) {
  const railRef = useRef<HTMLUListElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const drag = useRef<{ active: boolean; startX: number; startScrollLeft: number; moved: boolean }>({
    active: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });

  const updateScrollState = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = railRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  function scrollByCards(direction: 1 | -1) {
    const el = railRef.current;
    if (!el) return;
    const card = el.querySelector("li");
    const amount = (card?.clientWidth ?? 280) + 16; // + gap-4
    el.scrollBy({ left: amount * direction, behavior: "smooth" });
  }

  function onPointerDown(e: React.PointerEvent<HTMLUListElement>) {
    if (e.pointerType !== "mouse") return;
    const el = railRef.current;
    if (!el) return;
    drag.current = { active: true, startX: e.clientX, startScrollLeft: el.scrollLeft, moved: false };
  }

  function onPointerMove(e: React.PointerEvent<HTMLUListElement>) {
    if (!drag.current.active) return;
    const el = railRef.current;
    if (!el) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 3) drag.current.moved = true;
    el.scrollLeft = drag.current.startScrollLeft - dx;
  }

  function endDrag() {
    drag.current.active = false;
  }

  function onClickCapture(e: React.MouseEvent) {
    // A drag that ended on top of a card shouldn't also navigate it.
    if (drag.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = false;
    }
  }

  if (stories.length === 0) return null;

  return (
    <section aria-label="Trending" className="group/rail relative -mx-4 px-4 sm:mx-0 sm:px-0">
      <h2 className="mb-4 flex items-center gap-3 text-xl font-extrabold tracking-tight sm:text-2xl">
        <span className="bg-brand inline-block h-6 w-1.5 rounded-full" aria-hidden />
        Trending
      </h2>

      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByCards(-1)}
          aria-label="Scroll trending stories left"
          className="bg-canvas border-line text-ink hover:bg-surface absolute top-1/2 left-1 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border shadow-[var(--shadow-raised)] transition-colors sm:flex"
        >
          <ArrowRightIcon width={16} height={16} className="rotate-180" />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByCards(1)}
          aria-label="Scroll trending stories right"
          className="bg-canvas border-line text-ink hover:bg-surface absolute top-1/2 right-1 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border shadow-[var(--shadow-raised)] transition-colors sm:flex"
        >
          <ArrowRightIcon width={16} height={16} />
        </button>
      )}

      <ul
        ref={railRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:thin] active:cursor-grabbing sm:cursor-grab"
        role="list"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
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
                      draggable={false}
                      className="object-cover transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span className="from-ink to-ink-deep flex h-full w-full items-center justify-center bg-gradient-to-br">
                      <span className="text-brand-ink text-sm font-extrabold">
                        {story.category?.name ?? "PerkTonic"}
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
