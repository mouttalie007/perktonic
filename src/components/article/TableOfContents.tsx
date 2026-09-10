"use client";

import { useEffect, useId, useState } from "react";
import type { TocItem } from "@/lib/article-html";
import { ChevronDownIcon } from "@/components/icons";

/**
 * "In this article" table of contents (spec §25, §27). A collapsible box —
 * collapsed by default, opens on click — plus a scroll-spy that highlights the
 * section currently in view. Rendered only when the article has 3+ headings.
 */
export function TableOfContents({ items }: { items: TocItem[] }) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const panelId = useId();

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

  return (
    <nav
      aria-label="Table of contents"
      className="border-line my-8 overflow-hidden rounded-sm border"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="text-ink flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-meta text-muted font-bold tracking-[0.15em] uppercase">
          In this article
          <span className="ml-1.5 normal-case">({items.length})</span>
        </span>
        <ChevronDownIcon
          width={16}
          height={16}
          className={`text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ol id={panelId} className="border-line space-y-0.5 border-t px-2 pt-2 pb-3">
          {items.map((item) => {
            const active = activeId === item.id;
            return (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  aria-current={active ? "true" : undefined}
                  className={`block border-l-2 py-1 text-[0.88rem] leading-snug transition-colors ${
                    item.level === 3 ? "pl-6" : "pl-3"
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
      )}
    </nav>
  );
}
