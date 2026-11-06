import Link from "next/link";
import type { Route } from "next";

export type BlogView = "list" | "grid";

export interface BlogQuery {
  view: BlogView;
  cat: string | null;
  page: number;
}

/** The blog index URL for a state; defaults (list view, all categories, page 1) are left out. */
export function blogUrl(q: Partial<BlogQuery>): Route {
  const params = new URLSearchParams();
  if (q.cat) params.set("cat", q.cat);
  if (q.view === "grid") params.set("view", "grid");
  if (q.page && q.page > 1) params.set("page", String(q.page));
  const s = params.toString();
  return (s ? `/blog?${s}` : "/blog") as Route;
}

const pill = (active: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.8rem] font-semibold whitespace-nowrap transition-colors ${
    active
      ? "border-ink bg-ink text-white"
      : "border-line bg-canvas text-ink hover:bg-surface"
  }`;

/**
 * Category filter (links, no JavaScript) and the List / Grid switch.
 * Changing the filter or the view goes back to page 1.
 */
export function BlogControls({
  query,
  categories,
  total,
}: {
  query: BlogQuery;
  categories: { slug: string; name: string; count: number; color: string | null }[];
  total: number;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <nav aria-label="Filter by category" className="flex flex-wrap gap-2">
        <Link
          href={blogUrl({ view: query.view })}
          aria-current={query.cat === null ? "true" : undefined}
          className={pill(query.cat === null)}
        >
          All
          <span className="text-[0.7rem] opacity-70">{total}</span>
        </Link>
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={blogUrl({ cat: c.slug, view: query.view })}
            aria-current={query.cat === c.slug ? "true" : undefined}
            className={pill(query.cat === c.slug)}
          >
            {c.color && (
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ background: c.color }}
              />
            )}
            {c.name}
            <span className="text-[0.7rem] opacity-70">{c.count}</span>
          </Link>
        ))}
      </nav>

      <div
        role="group"
        aria-label="Layout"
        className="border-line bg-canvas inline-flex shrink-0 overflow-hidden rounded-sm border"
      >
        {(["list", "grid"] as const).map((v) => (
          <Link
            key={v}
            href={blogUrl({ cat: query.cat, view: v })}
            aria-current={query.view === v ? "true" : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[0.8rem] font-semibold ${
              query.view === v ? "bg-ink text-white" : "text-ink hover:bg-surface"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              {v === "list" ? (
                <path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round" />
              ) : (
                <path d="M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z" strokeLinejoin="round" />
              )}
            </svg>
            {v === "list" ? "List" : "Grid"}
          </Link>
        ))}
      </div>
    </div>
  );
}
