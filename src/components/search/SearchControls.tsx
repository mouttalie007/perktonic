"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SearchIcon } from "@/components/icons";
import type { CategoryDef } from "@/config/site";

/**
 * Search page controls (spec §29): query box + category filter + sort.
 * Plain GET navigation under the hood — works without JS via the form
 * submit; the selects additionally auto-navigate on change for convenience.
 */
export function SearchControls({
  categories,
  initial,
}: {
  categories: CategoryDef[];
  initial: { q: string; category: string; sort: string };
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(initial.q);

  function navigate(next: Partial<typeof initial>) {
    const params = new URLSearchParams();
    const merged = { ...initial, ...next };
    if (merged.q) params.set("q", merged.q);
    if (merged.category) params.set("category", merged.category);
    if (merged.sort && merged.sort !== "newest") params.set("sort", merged.sort);
    startTransition(() => router.push(`/search?${params.toString()}`));
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        navigate({ q });
      }}
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
    >
      <div className="border-line focus-within:ring-accent-blue flex min-w-0 flex-1 items-center gap-2 rounded-sm border px-3 py-2.5 focus-within:ring-2">
        <SearchIcon width={18} height={18} className="text-muted shrink-0" />
        <label htmlFor="search-q" className="sr-only">
          Search ViralTrendly
        </label>
        <input
          id="search-q"
          name="q"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search ViralTrendly..."
          className="placeholder:text-muted min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Filter by category"
          value={initial.category}
          onChange={(e) => navigate({ category: e.target.value })}
          className="border-line min-w-0 flex-1 rounded-sm border bg-white px-3 py-2.5 text-sm sm:flex-none"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Sort by"
          value={initial.sort}
          onChange={(e) => navigate({ sort: e.target.value })}
          className="border-line min-w-0 flex-1 rounded-sm border bg-white px-3 py-2.5 text-sm sm:flex-none"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>

        <button
          type="submit"
          className="bg-ink hover:bg-ink-deep w-full shrink-0 rounded-sm px-4 py-2.5 text-sm font-bold text-white transition-colors sm:w-auto"
        >
          Search
        </button>
      </div>
    </form>
  );
}
