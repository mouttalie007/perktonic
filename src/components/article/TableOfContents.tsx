"use client";

import { useEffect, useState } from "react";
import type { TocItem } from "@/lib/article-html";

/**
 * "In this article" table of contents (spec §25, §27). Anchor links plus a
 * scroll-spy that highlights the section in view. Two presentations:
 *  - `inline`  : bordered box in the flow (mobile / tablet)
 *  - `sidebar` : sticky rail in the right margin on wide screens
 * Rendered only when the article has 3+ headings.
 */
export function TableOfContents({
  items,
  variant = "inline",
}: {
  items: TocItem[];
  variant?: "inline" | "sidebar";
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const headings = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-88px 0px -68% 0px", threshold: 0 },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [items]);

  const list = (
    <ol className="space-y-1">
      {items.map((item) => {
        const active = activeId === item.id;
        return (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={active ? "true" : undefined}
              className={`block border-l-2 py-1 text-[0.86rem] leading-snug transition-colors ${
                item.level === 3 ? "pl-5" : "pl-3"
              } ${
                active
                  ? "border-brand text-ink font-semibold"
                  : "text-muted hover:text-ink border-transparent"
              }`}
            >
              {item.text}
            </a>
          </li>
        );
      })}
    </ol>
  );

  if (variant === "sidebar") {
    return (
      <nav
        aria-label="Table of contents"
        className="sticky top-8 max-h-[calc(100vh-6rem)] overflow-y-auto"
      >
        <p className="text-meta text-muted mb-3 font-bold tracking-[0.15em] uppercase">
          In this article
        </p>
        {list}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Table of contents"
      className="border-line my-8 rounded-sm border-y py-4 xl:hidden"
    >
      <p className="text-meta text-muted mb-2 font-bold tracking-[0.15em] uppercase">
        In this article
      </p>
      {list}
    </nav>
  );
}
