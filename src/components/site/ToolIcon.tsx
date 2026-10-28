import type { ReactNode } from "react";

/**
 * Coloured icon chips for tools and categories (homepage redesign, 2026-10-29).
 * Pure inline SVG: nothing to download, crisp at any size, no layout shift.
 */
const CHIPS: Record<string, { bg: string; glyph: ReactNode }> = {
  sheet: {
    bg: "bg-emerald-100",
    glyph: (
      <g>
        <rect x="4" y="3" width="16" height="18" rx="3" fill="#16a34a" />
        <path
          d="M8 9h8M8 12.5h8M8 16h8M12 7.5v11"
          stroke="#fff"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </g>
    ),
  },
  database: {
    bg: "bg-violet-100",
    glyph: (
      <g fill="#7c3aed">
        <ellipse cx="12" cy="6.5" rx="7" ry="3" />
        <path d="M5 9.5c0 1.7 3.1 3 7 3s7-1.3 7-3v3c0 1.7-3.1 3-7 3s-7-1.3-7-3z" />
        <path d="M5 15.5c0 1.7 3.1 3 7 3s7-1.3 7-3v2c0 1.7-3.1 3-7 3s-7-1.3-7-3z" />
      </g>
    ),
  },
  pdf: {
    bg: "bg-red-100",
    glyph: (
      <g>
        <path
          d="M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
          fill="#ef4444"
        />
        <path d="M14 3v4a1 1 0 0 0 1 1h4" fill="#fecaca" />
        <path
          d="M8.5 16.5c2-1 3.5-3.5 3.5-5.5 0-1-.7-1.2-1-.5-.5 1.4.7 3.6 3 4.3 1.2.4 2 .2 1.8-.5-.3-.8-2.5-.4-5.3.7-1 .4-1.6.9-2 1.5z"
          stroke="#fff"
          strokeWidth="1.1"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    ),
  },
  gear: {
    bg: "bg-amber-100",
    glyph: (
      <g fill="#f59e0b">
        <path d="M10.3 2.8h3.4l.5 2.3 1.6.7 2-1.3 2.4 2.4-1.3 2 .7 1.6 2.3.5v3.4l-2.3.5-.7 1.6 1.3 2-2.4 2.4-2-1.3-1.6.7-.5 2.3h-3.4l-.5-2.3-1.6-.7-2 1.3-2.4-2.4 1.3-2-.7-1.6-2.3-.5v-3.4l2.3-.5.7-1.6-1.3-2 2.4-2.4 2 1.3 1.6-.7z" />
        <circle cx="12" cy="12" r="3.4" fill="#fef3c7" />
      </g>
    ),
  },
  globe: {
    bg: "bg-blue-100",
    glyph: (
      <g fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17M12 3.5c-3 3-3 14 0 17M12 3.5c3 3 3 14 0 17" />
      </g>
    ),
  },
  "globe-purple": {
    bg: "bg-indigo-100",
    glyph: (
      <g fill="none" stroke="#6d28d9" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17M12 3.5c-3 3-3 14 0 17M12 3.5c3 3 3 14 0 17" />
      </g>
    ),
  },
  swap: {
    bg: "bg-violet-100",
    glyph: (
      <g
        fill="none"
        stroke="#7c3aed"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 8h14M14 4l4 4-4 4" />
        <path d="M20 16H6M10 12l-4 4 4 4" />
      </g>
    ),
  },
  code: {
    bg: "bg-amber-100",
    glyph: (
      <g
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14" />
      </g>
    ),
  },
  clock: {
    bg: "bg-blue-100",
    glyph: (
      <g
        fill="none"
        stroke="#2563eb"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3 2" />
      </g>
    ),
  },
};

export function ToolIcon({
  kind,
  size = 56,
  className = "",
}: {
  kind: string;
  /** Chip size in px (the glyph is 50% of it). */
  size?: number;
  className?: string;
}) {
  const chip = CHIPS[kind] ?? CHIPS.globe;
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-2xl ${chip.bg} ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.56}
        height={size * 0.56}
        viewBox="0 0 24 24"
        focusable="false"
      >
        {chip.glyph}
      </svg>
    </span>
  );
}
