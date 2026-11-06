"use client";

import { useEffect, useMemo, useState } from "react";
import { ToolIcon } from "@/components/site/ToolIcon";
import { ToolCard } from "@/components/tools/ToolCard";
import { CATEGORY_THEME } from "@/config/category-theme";
import type { CategoryDef } from "@/config/site";
import type { ToolDef } from "@/config/tools";

/**
 * The tools hub: a sticky category filter, a search box and the tools grouped by category.
 * The filter is kept in the URL (?cat=data-converters) so a filtered view can be shared.
 */
const SHORT: Record<string, string> = {
  "spreadsheet-studio": "Spreadsheets",
  "data-converters": "Data & files",
  "document-intelligence": "Documents",
  "workflow-automation": "Automation",
  "web-diagnostics": "Web & network",
};

export function ToolsExplorer({
  tools,
  categories,
}: {
  tools: ToolDef[];
  categories: CategoryDef[];
}) {
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("cat");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (c && categories.some((x) => x.slug === c)) setCat(c);
  }, [categories]);

  const choose = (slug: string | null) => {
    setCat(slug);
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set("cat", slug);
    else url.searchParams.delete("cat");
    window.history.replaceState(null, "", url);
  };

  const needle = q.trim().toLowerCase();
  const matches = useMemo(
    () =>
      tools.filter(
        (t) =>
          (cat === null || t.categorySlug === cat) &&
          (needle === "" || `${t.name} ${t.description}`.toLowerCase().includes(needle)),
      ),
    [tools, cat, needle],
  );

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tools) m.set(t.categorySlug, (m.get(t.categorySlug) ?? 0) + 1);
    return m;
  }, [tools]);

  const pill = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[0.84rem] font-semibold whitespace-nowrap transition-colors ${
      active
        ? "border-navy bg-navy text-white shadow-sm"
        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
    }`;

  return (
    <>
      <div className="sticky top-[65px] z-20 border-y border-slate-200/70 bg-white/85 backdrop-blur-md">
        <div className="site-container flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
          <nav
            aria-label="Filter tools by category"
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible lg:pb-0"
          >
            <button type="button" onClick={() => choose(null)} aria-pressed={cat === null} className={pill(cat === null)}>
              All tools
              <span className="text-[0.72rem] opacity-80">{tools.length}</span>
            </button>
            {categories.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => choose(c.slug)}
                aria-pressed={cat === c.slug}
                className={pill(cat === c.slug)}
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: CATEGORY_THEME[c.slug].base }}
                />
                {SHORT[c.slug] ?? c.name}
                <span className="text-[0.72rem] opacity-80">{counts.get(c.slug) ?? 0}</span>
              </button>
            ))}
          </nav>
          <label className="relative block lg:w-64">
            <span className="sr-only">Search the tools</span>
            <svg
              aria-hidden
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the tools…"
              className="w-full rounded-full border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            />
          </label>
        </div>
      </div>

      <div className="site-container mt-8 space-y-12 pb-16" aria-live="polite">
        {matches.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-600">
            No tool matches “{q}”. Try another word or choose All tools.
          </p>
        )}
        {categories.map((c) => {
          const list = matches.filter((t) => t.categorySlug === c.slug);
          if (list.length === 0) return null;
          const th = CATEGORY_THEME[c.slug];
          return (
            <section key={c.slug} aria-labelledby={`cat-${c.slug}`}>
              <div className="mb-5 flex items-center gap-4">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ring-black/[0.04]"
                  style={{
                    background: `linear-gradient(145deg, #fff 0%, ${th.tint} 100%)`,
                    boxShadow: `0 10px 20px -10px ${th.base}80, inset 0 1px 0 #fff`,
                  }}
                >
                  <ToolIcon kind={c.iconKey} category={c.slug} size={40} />
                </span>
                <div className="min-w-0">
                  <h2 id={`cat-${c.slug}`} className="font-heading text-navy text-xl font-extrabold tracking-tight sm:text-[1.4rem]">
                    {c.name}
                    <span className="ml-2 align-middle text-sm font-semibold" style={{ color: th.deep }}>
                      {list.length} {list.length === 1 ? "tool" : "tools"}
                    </span>
                  </h2>
                  <p className="text-slate-ink text-sm">{c.shortDescription}</p>
                </div>
                <span
                  aria-hidden
                  className="ml-2 hidden h-px flex-1 sm:block"
                  style={{ background: `linear-gradient(90deg, ${th.base}55, transparent)` }}
                />
              </div>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((t) => (
                  <li key={t.slug}>
                    <ToolCard tool={t} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
