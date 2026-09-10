"use client";

import { useEffect, useState } from "react";
import type { TocItem } from "@/lib/article-html";

/**
 * "In this article" table of contents (spec §25, §27). Anchor links plus a
 * lightweight scroll-spy that highlights the section currently in view.
 * Rendered only when the article has 3+ headings.
 */
export function TableOfContents({ items }: { items: TocItem[] }) {
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
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav
      aria-label="Table of contents"
      className="border-line bg-surface/60 my-8 rounded-sm border p-4"
    >
      <p className="text-meta text-muted mb-2 font-bold tracking-[0.15em] uppercase">
        In this article
      </p>
      <ol className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item.id}
            className={item.level === 3 ? "pl-4" : undefined}
          >
            <a
              href={`#${item.id}`}
              aria-current={activeId === item.id ? "true" : undefined}
              className={`text-[0.9rem] transition-colors ${
                activeId === item.id
                  ? "text-ink font-semibold"
                  : "text-muted hover:text-ink"
              }`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
