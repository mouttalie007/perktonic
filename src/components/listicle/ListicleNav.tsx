import Link from "next/link";
import type { Route } from "next";
import { ArrowRightIcon } from "@/components/icons";

/**
 * Prev / Next navigation for a listicle subpage (spec §4). Real server-rendered
 * <a> links — a full page load per item, never a client carousel.
 */
export function ListicleNav({
  prevPath,
  nextPath,
  allPath,
  position,
  total,
  className = "",
}: {
  prevPath: Route | null;
  nextPath: Route | null;
  allPath: Route;
  position: number;
  total: number;
  className?: string;
}) {
  return (
    <nav aria-label="Listicle navigation" className={className}>
      <div className="flex items-stretch gap-3">
        {prevPath ? (
          <Link
            href={prevPath}
            rel="prev"
            className="border-line text-ink hover:bg-surface group flex flex-1 items-center gap-2 rounded-sm border px-4 py-3 transition-colors"
          >
            <ArrowRightIcon
              width={16}
              height={16}
              className="shrink-0 rotate-180 transition-transform group-hover:-translate-x-0.5"
            />
            <span className="min-w-0">
              <span className="text-muted text-[0.7rem] font-bold tracking-wider uppercase">
                Previous
              </span>
              <span className="block truncate text-sm font-semibold">
                {position - 1 === 0 ? "Introduction" : `Item ${position - 1}`}
              </span>
            </span>
          </Link>
        ) : (
          <span className="flex-1" />
        )}

        {nextPath ? (
          <Link
            href={nextPath}
            rel="next"
            className="bg-ink hover:bg-ink-deep group flex flex-1 items-center justify-end gap-2 rounded-sm px-4 py-3 text-right text-white transition-colors"
          >
            <span className="min-w-0">
              <span className="text-[0.7rem] font-bold tracking-wider text-white/60 uppercase">
                Next
              </span>
              <span className="block truncate text-sm font-semibold">
                Item {position + 1} of {total}
              </span>
            </span>
            <ArrowRightIcon
              width={16}
              height={16}
              className="shrink-0 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        ) : (
          <Link
            href={allPath}
            className="border-line text-ink hover:bg-surface flex flex-1 items-center justify-center rounded-sm border px-4 py-3 text-sm font-semibold transition-colors"
          >
            See the full list on one page
          </Link>
        )}
      </div>

      {nextPath && (
        <div className="mt-3 text-center">
          <Link
            href={allPath}
            className="text-muted hover:text-ink text-[0.8rem] font-semibold underline underline-offset-2 transition-colors"
          >
            View all {total} on one page
          </Link>
        </div>
      )}
    </nav>
  );
}
