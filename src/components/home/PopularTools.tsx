import Link from "next/link";
import type { Route } from "next";
import { popularTools, toolHref } from "@/config/tools";
import { CATEGORY_THEME } from "@/config/category-theme";
import { ToolIcon } from "@/components/site/ToolIcon";
import { CardArrow, SectionHeading } from "./SectionHeading";

/** "Popular Tools": 6 cards (3 per row on desktop). */
export function PopularTools() {
  const tools = popularTools();
  return (
    <section
      aria-labelledby="home-popular"
      className="site-container pt-10 sm:pt-12"
    >
      <SectionHeading
        id="home-popular"
        title="Popular Tools"
        subtitle="Check out some of the most used tools on PerkTonic."
        href="/tools"
        linkLabel="View All"
      />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
        {tools.map((t) => {
          const th = CATEGORY_THEME[t.categorySlug];
          return (
            <li key={t.slug}>
              <Link
                href={toolHref(t) as Route}
                style={{ ["--cat" as string]: th.base }}
                className="group relative flex h-full items-center gap-4 overflow-hidden rounded-2xl bg-white p-4 pr-5 shadow-[var(--shadow-soft)] ring-1 ring-slate-900/[0.06] transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft-hover)] hover:ring-[color:var(--cat)]"
              >
                <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: th.base }} />
                <span
                  className="grid size-[4.25rem] shrink-0 place-items-center rounded-2xl ring-1 ring-black/[0.04]"
                  style={{
                    background: `linear-gradient(145deg, #fff 0%, ${th.tint} 100%)`,
                    boxShadow: `0 8px 18px -8px ${th.base}66, inset 0 1px 0 #fff`,
                  }}
                >
                  <ToolIcon kind={t.iconKey} slug={t.slug} size={56} className="drop-shadow-sm" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading text-navy text-[1rem] leading-snug font-bold">{t.name}</h3>
                  <p className="text-slate-ink mt-1 line-clamp-2 text-[0.85rem] leading-snug">{t.description}</p>
                </div>
                <CardArrow className="hidden sm:inline-flex" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
