import Link from "next/link";

/** Root fallback 404 (unmatched paths outside the site group). */
export default function RootNotFound() {
  return (
    <div className="site-container flex min-h-[70vh] flex-col items-center justify-center py-24 text-center">
      <p className="text-brand-ink text-6xl font-extrabold">404</p>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
        Page not found
      </h1>
      <Link
        href="/"
        className="bg-ink hover:bg-ink-deep mt-8 rounded-sm px-5 py-2.5 text-sm font-bold text-white transition-colors"
      >
        Return Home
      </Link>
    </div>
  );
}
