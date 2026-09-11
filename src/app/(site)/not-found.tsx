import Link from "next/link";
import type { Route } from "next";

/**
 * 404 within the public site (spec §54). Not a dead end — offers a way back.
 * Phase 6 gives this its final design + "Explore Trending" content.
 */
export default function NotFound() {
  return (
    <div className="site-container flex flex-col items-center py-24 text-center sm:py-32">
      <p className="text-brand-ink text-6xl font-extrabold sm:text-7xl">
        404
      </p>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
        Looks like this story went viral and disappeared.
      </h1>
      <p className="text-muted mt-3 max-w-md">
        The page you’re looking for may have been moved, renamed, or never
        existed.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="bg-ink hover:bg-ink-deep rounded-sm px-5 py-2.5 text-sm font-bold text-white transition-colors"
        >
          Return Home
        </Link>
        <Link
          href={"/category/viral" as Route}
          className="border-line text-ink hover:bg-surface rounded-sm border px-5 py-2.5 text-sm font-bold transition-colors"
        >
          Explore Trending Stories
        </Link>
      </div>
    </div>
  );
}
