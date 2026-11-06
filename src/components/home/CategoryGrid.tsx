import Link from "next/link";
import type { Route } from "next";
import { CATEGORIES } from "@/config/site";
import { CATEGORY_THEME } from "@/config/category-theme";
import { ToolIcon } from "@/components/site/ToolIcon";
import { CardArrow, SectionHeading } from "./SectionHeading";

/** "Explore Tools by Category": 5 cards (2 columns on phones, the 5th spans the row). */
export function CategoryGrid() {
  return (
    <section
      aria-labelledby="home-categories"
      className="site-container pt-10 sm:pt-12"
    >
      <SectionHeading
        id="home-categories"
        title="Explore Tools by Category"
        href="/tools"
        linkLabel="View All"
      />
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
        {CATEGORIES.map((c, i) => (
          <li
            key={c.slug}
            className={
              i === CATEGORIES.length - 1 ? "col-span-2 md:col-span-1" : ""
            }
          >
            <Link
              href={`/category/${c.slug}` as Route}
              style={{
                ["--cat" as string]: CATEGORY_THEME[c.slug].base,
                background: `linear-gradient(160deg, ${CATEGORY_THEME[c.slug].tint} 0%, #fff 62%)`,
              }}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl p-3.5 shadow-[var(--shadow-soft)] ring-1 ring-slate-900/[0.06] transition duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-soft-hover)] hover:ring-[color:var(--cat)] sm:p-5 lg:min-h-[15rem]"
            >
              <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: CATEGORY_THEME[c.slug].base }} />
              <span
                aria-hidden
                className="pointer-events-none absolute -top-8 -left-6 h-28 w-28 rounded-full opacity-25 blur-2xl"
                style={{ background: CATEGORY_THEME[c.slug].base }}
              />
              <div className="relative">
                <ToolIcon
                  kind={c.iconKey}
                  category={c.slug}
                  size={96}
                  fluid
                  className="size-14 drop-shadow-md transition-transform duration-200 group-hover:scale-105 sm:size-16 lg:size-[5.5rem]"
                />
                <h3 className="font-heading text-navy min-w-0 text-[0.9rem] leading-snug font-bold sm:text-[0.95rem] mt-2 lg:mt-3 lg:text-[1.1rem]">
                  {c.name}
                </h3>
              </div>
              <p className="text-slate-ink relative mt-2 pr-8 text-[0.78rem] leading-snug lg:mt-1.5 lg:pr-9 lg:text-[0.88rem]">
                {c.shortDescription}
              </p>
              <CardArrow className="absolute right-3 bottom-3 lg:right-4 lg:bottom-4" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
