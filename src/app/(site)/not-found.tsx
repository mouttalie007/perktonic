import Link from "next/link";
import type { Metadata, Route } from "next";
import { CATEGORIES } from "@/config/site";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

/**
 * 404 within the public site (spec §54, perktonic-seo.md §4.11). Not a dead
 * end — offers a way back to Search and to every real category.
 */
export default function NotFound() {
  return (
    <div className="site-container flex flex-col items-center py-24 text-center sm:py-32">
      <p className="text-brand-ink text-6xl font-extrabold sm:text-7xl">
        404
      </p>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
        This page isn&apos;t here.
      </h1>
      <p className="text-muted mt-3 max-w-md">
        The page you’re looking for may have been moved, renamed, or never
        existed. Try a search, open the tools, or browse a category below.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="bg-ink hover:bg-ink-deep rounded-sm px-5 py-2.5 text-sm font-bold text-white transition-colors"
        >
          Return Home
        </Link>
        <Link
          href={"/tools" as Route}
          className="border-line text-ink hover:bg-surface rounded-sm border px-5 py-2.5 text-sm font-bold transition-colors"
        >
          All tools
        </Link>
        <Link
          href={"/search" as Route}
          className="border-line text-ink hover:bg-surface rounded-sm border px-5 py-2.5 text-sm font-bold transition-colors"
        >
          Search PerkTonic
        </Link>
      </div>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={`/category/${c.slug}` as Route}
            className="border-line text-ink/70 hover:bg-surface hover:text-ink rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors"
          >
            {c.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
