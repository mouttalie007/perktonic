import Link from "next/link";

/**
 * ViralTrendly wordmark (spec §7). Text/vector — never a raster image.
 * "Viral" + ".com" take the foreground colour, "Trendly" is brand yellow.
 * Pass `onDark` on dark surfaces (footer) so it keeps AA contrast.
 */
export function Logo({
  withTagline = false,
  onDark = false,
  className = "",
}: {
  withTagline?: boolean;
  onDark?: boolean;
  className?: string;
}) {
  const fg = onDark ? "text-white" : "text-ink";
  const tag = onDark ? "text-white/55" : "text-muted";

  return (
    <Link
      href="/"
      className={`group inline-flex flex-col leading-none ${className}`}
      aria-label="ViralTrendly.com — home"
    >
      <span
        className={`text-xl font-extrabold tracking-tight sm:text-2xl xl:text-[1.7rem] ${fg}`}
      >
        Viral<span className="text-brand">Trendly</span>
        <span className={fg}>.com</span>
      </span>
      {withTagline && (
        <span
          className={`mt-1 text-[0.6rem] font-semibold tracking-[0.22em] uppercase sm:text-[0.65rem] ${tag}`}
        >
          Trend Today. Talk Tomorrow.
        </span>
      )}
    </Link>
  );
}
