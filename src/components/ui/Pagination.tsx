import Link from "next/link";
import type { Route } from "next";
import { paginationRange } from "@/lib/pagination";

/**
 * Prev / numbered / Next pagination (spec §70). The caller builds each page's
 * URL so this works for category pages (?page=N) and search (?q=..&page=N)
 * alike, keeping other query params intact.
 */
export function Pagination({
  page,
  totalPages,
  buildHref,
  className = "",
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => Route;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  const items = paginationRange(page, totalPages);

  const linkCls = (active = false) =>
    `flex h-9 min-w-9 items-center justify-center rounded-sm px-2 text-sm font-semibold transition-colors ${
      active
        ? "bg-ink text-white"
        : "border-line border text-ink hover:bg-surface"
    }`;

  return (
    <nav aria-label="Pagination" className={className}>
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        <li>
          {page > 1 ? (
            <Link href={buildHref(page - 1)} className={linkCls()} aria-label="Previous page">
              Prev
            </Link>
          ) : (
            <span className="text-line flex h-9 min-w-9 items-center justify-center px-2 text-sm font-semibold">
              Prev
            </span>
          )}
        </li>
        {items.map((item, i) =>
          item === "…" ? (
            <li key={`e${i}`} className="text-muted px-1" aria-hidden>
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                href={buildHref(item)}
                aria-current={item === page ? "page" : undefined}
                className={linkCls(item === page)}
              >
                {item}
              </Link>
            </li>
          ),
        )}
        <li>
          {page < totalPages ? (
            <Link
              href={buildHref(page + 1)}
              className={linkCls()}
              aria-label="Next page"
            >
              Next
            </Link>
          ) : (
            <span className="text-line flex h-9 min-w-9 items-center justify-center px-2 text-sm font-semibold">
              Next
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
