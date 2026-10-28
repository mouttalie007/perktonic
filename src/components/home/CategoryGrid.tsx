import Link from "next/link";
import type { Route } from "next";
import { CATEGORIES } from "@/config/site";
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
              className="group relative flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-soft-hover)] sm:p-5 lg:min-h-[13.5rem]"
            >
              <div className="flex items-start gap-2.5 lg:block">
                <ToolIcon
                  kind={c.iconKey}
                  size={36}
                  className="!rounded-xl lg:!h-14 lg:!w-14 lg:!rounded-2xl"
                />
                <h3 className="font-heading text-navy min-w-0 text-[0.85rem] leading-snug font-bold sm:text-[0.95rem] lg:mt-4 lg:text-[1.1rem]">
                  {c.name}
                </h3>
              </div>
              <p className="text-slate-ink mt-2 pr-8 text-[0.78rem] leading-snug lg:mt-1.5 lg:pr-0 lg:text-[0.88rem]">
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
