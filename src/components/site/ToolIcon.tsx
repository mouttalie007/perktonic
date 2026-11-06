/**
 * Icons for tools and categories (homepage redesign, 2026-10-29).
 *
 * Professional Fluent colour icons (Microsoft, MIT licence) fetched once from
 * the free Iconify API and stored as small self-hosted SVG files in
 * public/brand/icons (see SOURCES.txt there): no third-party request at
 * runtime, each file 1-3 KB and cached by the browser.
 */
import { CATEGORY_ICON_SLUGS, TOOL_ICON_SLUGS } from "@/config/tool-icons";

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
  slug,
  category,
  size = 56,
  fluid = false,
  className = "",
}: {
  kind: string;
  /** Tool slug: uses the tool's own 3D icon when public/brand/tool-icons has one. */
  slug?: string;
  /** Category slug: uses the category's own 3D icon when public/brand/category-icons has one. */
  category?: string;
  /** Rendered size in px. */
  size?: number;
  /** Let the className set the displayed size (width and height attributes stay as the intrinsic size). */
  fluid?: boolean;
  className?: string;
}) {
  const own =
    category !== undefined && CATEGORY_ICON_SLUGS.has(category)
      ? `/brand/category-icons/${category}.webp`
      : slug !== undefined && TOOL_ICON_SLUGS.has(slug)
        ? `/brand/tool-icons/${slug}.webp`
        : null;
  const file = FILE[kind] ?? "globe";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={own ?? `/brand/icons/${file}.svg`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={`inline-block shrink-0 ${className}`}
      style={fluid ? undefined : { width: size, height: size }}
    />
  );
}
