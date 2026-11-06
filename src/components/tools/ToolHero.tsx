import type { ReactNode } from "react";
import { ToolIcon } from "@/components/site/ToolIcon";
import { CATEGORY_THEME } from "@/config/category-theme";
import type { CategoryKey } from "@/config/site";

const svg = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const CheckIcon = () => (
  <svg {...svg}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
const BoltIcon = () => (
  <svg {...svg}>
    <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />
  </svg>
);
const UserIcon = () => (
  <svg {...svg}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M5 20c.8-3.6 3.6-5.4 7-5.4s6.2 1.8 7 5.4" />
  </svg>
);
const ShieldIcon = () => (
  <svg {...svg}>
    <path d="M12 3 5 6v5.5c0 4.2 2.8 7.6 7 9.5 4.2-1.9 7-5.3 7-9.5V6l-7-3Z" />
    <path d="m9.2 12 2 2 3.6-4" />
  </svg>
);

function Badge({ tone, icon, children }: { tone: string; icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className={`grid size-8 shrink-0 place-items-center rounded-full ${tone}`}>{icon}</span>
      <span className="text-navy text-[0.84rem] leading-tight font-semibold sm:text-sm">{children}</span>
    </li>
  );
}

/**
 * Top of a tool page: icon tile, H1, one-line intro and the trust badges. The
 * privacy badge tells the truth per tool (browser-only vs. sends a URL to us).
 */
export function ToolHero({
  iconKey,
  slug,
  categorySlug,
  h1,
  intro,
}: {
  iconKey: string;
  slug: string;
  categorySlug: CategoryKey;
  h1: string;
  intro: string;
}) {
  const theme = CATEGORY_THEME[categorySlug];
  return (
    <header className="mt-5 flex items-start gap-4 sm:gap-6">
      <span
        className="grid size-[4.5rem] shrink-0 place-items-center rounded-3xl ring-1 ring-black/[0.05] sm:size-28"
        style={{
          background: `linear-gradient(145deg, #fff 0%, ${theme.tint} 100%)`,
          boxShadow: `0 14px 30px -12px ${theme.base}80, inset 0 1px 0 #fff`,
        }}
      >
        <ToolIcon kind={iconKey} slug={slug} size={96} fluid className="size-14 drop-shadow-sm sm:size-[5.5rem]" />
      </span>
      <div className="min-w-0">
        <h1 className="font-heading text-navy text-[1.75rem] leading-[1.12] font-extrabold tracking-tight sm:text-4xl lg:text-[2.6rem]">
          {h1}
        </h1>
        {intro && <p className="text-slate-ink mt-2.5 max-w-3xl text-[0.95rem] leading-relaxed sm:mt-3 sm:text-lg">{intro}</p>}
      </div>
    </header>
  );
}

/** Trust badges row, shown under the hero. */
export function ToolBadges({ serverSide, ai, badge }: { serverSide?: boolean; ai?: boolean; badge?: string }) {
  return (
    <ul
      aria-label="Highlights"
      className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-8"
    >
      <Badge tone="bg-emerald-100 text-emerald-700" icon={<CheckIcon />}>
        Free to use
      </Badge>
      <Badge tone="bg-amber-100 text-amber-700" icon={<UserIcon />}>
        No account required
      </Badge>
      <Badge tone="bg-blue-100 text-blue-700" icon={<BoltIcon />}>
        Instant results
      </Badge>
      <Badge tone="bg-violet-100 text-violet-700" icon={<ShieldIcon />}>
        {badge ?? (ai ? "Sent to the AI only when you press the button" : serverSide ? "Only the URL is sent to our server" : "Private: runs in your browser")}
      </Badge>
    </ul>
  );
}
