import type { SVGProps } from "react";

/**
 * Simple line icons for category identifiers (spec §13, §17). Keyed by the
 * `iconKey` stored on Category rows. Unknown keys fall back to a dot.
 */

type P = SVGProps<SVGSVGElement>;

const s = (props: P) => ({
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false as const,
  ...props,
});

const ICONS: Record<string, (p: P) => React.ReactElement> = {
  gift: (p) => (
    <svg {...s(p)}>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <rect x="4" y="12" width="16" height="9" rx="1" />
      <path d="M12 8v13M12 8c-1.5-3.5-6-4-6-1 0 1.8 2 1 6 1Zm0 0c1.5-3.5 6-4 6-1 0 1.8-2 1-6 1Z" />
    </svg>
  ),
  home: (p) => (
    <svg {...s(p)}>
      <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8Z" />
    </svg>
  ),
  flame: (p) => (
    <svg {...s(p)}>
      <path d="M12 3c1 3.5 4 5 4 8.5A4 4 0 0 1 8 12c0-1 .3-1.8.8-2.5C9 11 10 12 11 12c-.5-3 .5-6 1-9Z" />
    </svg>
  ),
  users: (p) => (
    <svg {...s(p)}>
      <path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" />
      <circle cx="9" cy="7" r="3" />
      <path d="M22 19v-1a4 4 0 0 0-3-3.9M16 4a3 3 0 0 1 0 6" />
    </svg>
  ),
  cpu: (p) => (
    <svg {...s(p)}>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
      <path d="M10 10h4v4h-4zM9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
    </svg>
  ),
  coffee: (p) => (
    <svg {...s(p)}>
      <path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9ZM17 10h2a2.5 2.5 0 0 1 0 5h-2M7 3v2M11 3v2" />
    </svg>
  ),
  film: (p) => (
    <svg {...s(p)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 4v16M16 4v16M3 9h5M3 15h5M16 9h5M16 15h5" />
    </svg>
  ),
  plane: (p) => (
    <svg {...s(p)}>
      <path d="M10.5 13.5 3 12l0-2 7.5 1L15 4.5A2 2 0 0 1 18 7l-3.5 4.5 1 7.5h-2l-3-5Z" />
    </svg>
  ),
  heart: (p) => (
    <svg {...s(p)}>
      <path d="M12 20s-7-4.4-9.2-8.3A5.2 5.2 0 0 1 12 6a5.2 5.2 0 0 1 9.2 5.7C19 15.6 12 20 12 20Z" />
    </svg>
  ),
  atom: (p) => (
    <svg {...s(p)}>
      <circle cx="12" cy="12" r="1.5" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)" />
    </svg>
  ),
  trophy: (p) => (
    <svg {...s(p)}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M9 20h6M10 16v4M14 16v4" />
    </svg>
  ),
  sparkles: (p) => (
    <svg {...s(p)}>
      <path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8ZM19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z" />
    </svg>
  ),
  utensils: (p) => (
    <svg {...s(p)}>
      <path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-1.7 0-3 2-3 5s1.3 4 3 4v9" />
    </svg>
  ),
  wallet: (p) => (
    <svg {...s(p)}>
      <path d="M4 7a2 2 0 0 1 2-2h12v3M4 7v10a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H4Z" />
      <circle cx="16" cy="12" r="1" />
    </svg>
  ),
  palette: (p) => (
    <svg {...s(p)}>
      <path d="M12 3a9 9 0 0 0 0 18c1.7 0 2-1.2 1.2-2.2-.8-1 .1-2.3 1.3-2.3H17a4 4 0 0 0 4-4c0-4.8-4-9.5-9-9.5Z" />
      <circle cx="8" cy="10" r="1" />
      <circle cx="12" cy="7.5" r="1" />
      <circle cx="16" cy="10" r="1" />
    </svg>
  ),
  globe: (p) => (
    <svg {...s(p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9S14.5 18.5 12 21c-2.5-2.5-3.8-5.7-3.8-9S9.5 5.5 12 3Z" />
    </svg>
  ),
};

export function CategoryIcon({
  iconKey,
  ...props
}: { iconKey: string | null | undefined } & P) {
  const Icon = (iconKey && ICONS[iconKey]) || null;
  if (!Icon) {
    return (
      <svg {...s(props)}>
        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return <Icon {...props} />;
}
