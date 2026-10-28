/**
 * Icons for tools and categories (homepage redesign, 2026-10-29).
 *
 * Professional Fluent colour icons (Microsoft, MIT licence) fetched once from
 * the free Iconify API and stored as small self-hosted SVG files in
 * public/brand/icons (see SOURCES.txt there): no third-party request at
 * runtime, each file 1-3 KB and cached by the browser.
 */
const FILE: Record<string, string> = {
  sheet: "sheet",
  database: "database",
  pdf: "pdf",
  gear: "gear",
  globe: "globe",
  swap: "swap",
  code: "code",
  clock: "clock",
  link: "link",
  // legacy key used by the tool registry for the redirect-chain checker
  "globe-purple": "link",
};

export function ToolIcon({
  kind,
  size = 56,
  className = "",
}: {
  kind: string;
  /** Rendered size in px. */
  size?: number;
  className?: string;
}) {
  const file = FILE[kind] ?? "globe";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/brand/icons/${file}.svg`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={`inline-block shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
