import Link from "next/link";
import type { Route } from "next";
import { ToolIcon } from "@/components/site/ToolIcon";
import { ArrowRightIcon } from "@/components/icons";
import { CATEGORY_THEME } from "@/config/category-theme";
import { toolHref, type ToolDef } from "@/config/tools";

/** What the visitor should know about where the tool runs, taken from the registry flags. */
function trust(tool: ToolDef): { label: string; tone: "ai" | "server" | "local" } {
  if (tool.ai) return { label: "AI-assisted", tone: "ai" };
  if (tool.serverSide) return { label: "Checks a URL", tone: "server" };
  return { label: "Runs in your browser", tone: "local" };
}

const TONE: Record<"ai" | "server" | "local", string> = {
  ai: "bg-violet-50 text-violet-700",
  server: "bg-sky-50 text-sky-800",
  local: "bg-emerald-50 text-emerald-800",
};

/**
 * One tool in a grid (tools hub, category pages). The category colour tints the icon tile
 * and the hover ring; live tools link to the tool, the others carry a "Soon" badge.
 */
export function ToolCard({ tool }: { tool: ToolDef }) {
  const theme = CATEGORY_THEME[tool.categorySlug];
  const t = trust(tool);
  return (
    <Link
      href={toolHref(tool) as Route}
      style={{ ["--cat" as string]: theme.base }}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white p-5 shadow-[var(--shadow-soft)] ring-1 ring-slate-900/[0.06] transition duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-soft-hover)] hover:ring-[color:var(--cat)]"
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: theme.base }} />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full opacity-[0.10] blur-2xl transition-opacity group-hover:opacity-25"
        style={{ background: theme.base }}
      />
      <div className="flex items-start justify-between gap-3">
        <span
          className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl ring-1 ring-black/[0.04]"
          style={{
            background: `linear-gradient(145deg, #fff 0%, ${theme.tint} 100%)`,
            boxShadow: `0 8px 18px -8px ${theme.base}66, inset 0 1px 0 #fff`,
          }}
        >
          <ToolIcon kind={tool.iconKey} slug={tool.slug} size={60} className="drop-shadow-sm" />
        </span>
        {tool.status === "soon" ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.68rem] font-bold tracking-wide text-amber-800 uppercase">
            Soon
          </span>
        ) : (
          tool.popular && (
            <span
              className="rounded-full px-2 py-0.5 text-[0.68rem] font-bold tracking-wide uppercase"
              style={{ background: theme.tint, color: theme.deep }}
            >
              Popular
            </span>
          )
        )}
      </div>

      <h3 className="font-heading text-navy mt-4 text-[1.02rem] leading-snug font-bold">
        {tool.name}
      </h3>
      <p className="text-slate-ink mt-1.5 line-clamp-3 text-[0.88rem] leading-relaxed">
        {tool.description}
      </p>

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        <span className={`rounded-full px-2.5 py-1 text-[0.7rem] font-semibold ${TONE[t.tone]}`}>
          {t.label}
        </span>
        <span
          aria-hidden
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors group-hover:border-transparent group-hover:bg-[color:var(--cat)] group-hover:text-white"
        >
          <ArrowRightIcon width={15} height={15} />
        </span>
      </div>
    </Link>
  );
}
