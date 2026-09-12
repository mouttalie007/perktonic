"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { ChevronDownIcon } from "@/components/icons";

type QuickNavCategory = {
  slug: string;
  name: string;
  iconKey: string | null;
};

/**
 * Horizontal category quick-navigation (spec §13). White, thin borders,
 * yellow hover accent. Scrolls horizontally on narrow screens — with a
 * visible affordance (edge fade + arrow buttons) so it doesn't just look
 * like a cut-off list (user feedback, 2026-09-12: nothing signalled it was
 * scrollable).
 */
export function CategoryQuickNav({
  categories,
}: {
  categories: QuickNavCategory[];
}) {
  // The scroll container and the "won't shrink below its content" element
  // must be different nodes — putting overflow-x-auto and min-w-max on the
  // same element cancels both (min-w-max stops it from ever being narrower
  // than its content, so the parent's overflow never has anything to
  // scroll). Found via a real overflow test at 420px: scrollWidth reported
  // equal to clientWidth despite 3 of 7 categories being visibly cut off.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollState() {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    updateScrollState();
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => ro.disconnect();
  }, [categories.length]);

  function scrollBy(dir: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <nav
      aria-label="Browse by category"
      className="border-line bg-canvas relative w-full max-w-full rounded-sm border"
    >
      {canScrollLeft && (
        <>
          <div className="from-canvas pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r to-transparent" />
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Scroll categories left"
            className="border-line bg-canvas text-ink absolute top-1/2 left-1 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm"
          >
            <ChevronDownIcon width={14} height={14} className="rotate-90" />
          </button>
        </>
      )}

      <div
        ref={scrollerRef}
        onScroll={updateScrollState}
        className="overflow-x-auto [scrollbar-width:thin]"
      >
        <ul className="flex min-w-max divide-x divide-[var(--color-line)]">
          {categories.map((c) => (
            <li key={c.slug} className="flex-1">
              <Link
                href={`/category/${c.slug}` as Route}
                className="hover:border-b-brand text-ink/75 hover:text-ink flex min-w-[92px] flex-col items-center gap-1.5 border-b-2 border-transparent px-4 py-3 text-center transition-colors"
              >
                <CategoryIcon iconKey={c.iconKey} width={22} height={22} />
                <span className="text-[0.72rem] font-bold tracking-wide uppercase">
                  {c.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {canScrollRight && (
        <>
          <div className="from-canvas pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l to-transparent" />
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Scroll categories right"
            className="border-line bg-canvas text-ink absolute top-1/2 right-1 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm"
          >
            <ChevronDownIcon width={14} height={14} className="-rotate-90" />
          </button>
        </>
      )}
    </nav>
  );
}
