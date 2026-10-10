import Link from "next/link";
import { SITE } from "@/config/site";

/**
 * PerkTonic wordmark (spec §7; renamed from ViralTrendly 2026-10-08).
 * Text/vector — never a raster image. "Perk" + ".com" take the foreground
 * colour, "Tonic" is brand yellow. Pass `onDark` on dark surfaces (footer)
 * so it keeps AA contrast.
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
  // Brand yellow only clears AA contrast on a dark surface; on light
  // surfaces (the default) use the darker "ink" gold instead (see globals.css).
  const brand = onDark ? "text-brand" : "text-brand-ink";

  return (
    <Link href="/" className={`group inline-flex flex-col leading-none ${className}`}>
      <span
        className={`text-xl font-extrabold tracking-tight sm:text-2xl xl:text-[1.7rem] ${fg}`}
      >
        Perk<span className={brand}>Tonic</span>
        <span className={fg}>.com</span>
      </span>
      {withTagline && (
        <span
          className={`mt-1 text-[0.6rem] font-semibold tracking-[0.22em] uppercase sm:text-[0.65rem] ${tag}`}
        >
          {SITE.tagline}
        </span>
      )}
    </Link>
  );
}
