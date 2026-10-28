import Link from "next/link";
import type { Route } from "next";
import { popularTools, toolHref } from "@/config/tools";
import { ToolIcon } from "@/components/site/ToolIcon";
import { CardArrow, SectionHeading } from "./SectionHeading";

/** "Popular Tools": 6 cards on desktop, compact rows on phones. */
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
      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-6 lg:gap-4">
        {tools.map((t) => (
          <li key={t.slug}>
            <Link
              href={toolHref(t) as Route}
              className="group relative flex h-full items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-3 pr-4 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-soft-hover)] lg:min-h-[13.25rem] lg:flex-col lg:items-start lg:gap-0 lg:p-5"
            >
              <ToolIcon
                kind={t.iconKey}
                size={44}
                className="!rounded-xl lg:!h-12 lg:!w-12 lg:!rounded-2xl"
              />
              <div className="min-w-0 flex-1 lg:mt-4 lg:flex-none">
                <h3 className="font-heading text-navy text-[0.95rem] leading-snug font-bold">
                  {t.name}
                </h3>
                <p className="text-slate-ink mt-0.5 text-[0.82rem] leading-snug lg:mt-1.5 lg:pr-8">
                  {t.description}
                </p>
              </div>
              <CardArrow className="lg:absolute lg:right-4 lg:bottom-4" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
