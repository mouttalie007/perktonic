"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * 500-ish error boundary for the public site (spec §54, §57, §87). No stack
 * traces or internal details reach the user — only a generic message.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Detail stays in server/console logs only — never shown to the visitor.
    console.error(error);
  }, [error]);

  return (
    <div className="site-container flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <p className="text-accent-red text-6xl font-extrabold">Oops</p>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
        Something went wrong on our end.
      </h1>
      <p className="text-muted mt-3 max-w-md">
        We hit a snag loading this page. It has been logged — try again, or
        head back home.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="bg-ink hover:bg-ink-deep rounded-sm px-5 py-2.5 text-sm font-bold text-white transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="border-line text-ink hover:bg-surface rounded-sm border px-5 py-2.5 text-sm font-bold transition-colors"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
