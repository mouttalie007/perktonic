import Link from "next/link";

/**
 * ViralTrendly wordmark (spec §7). Text/vector — never a raster image.
 * "Viral" black · "Trendly" yellow · ".com" black.
 */
export function Logo({
  withTagline = false,
  className = "",
}: {
  withTagline?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      className={`group inline-flex flex-col leading-none ${className}`}
      aria-label="ViralTrendly.com — home"
    >
      <span className="text-ink text-2xl font-extrabold tracking-tight sm:text-[1.7rem]">
        Viral<span className="text-brand">Trendly</span>
        <span className="text-ink">.com</span>
      </span>
      {withTagline && (
        <span className="text-muted mt-1 text-[0.6rem] font-semibold tracking-[0.22em] uppercase sm:text-[0.65rem]">
          Trend Today. Talk Tomorrow.
        </span>
      )}
    </Link>
  );
}
