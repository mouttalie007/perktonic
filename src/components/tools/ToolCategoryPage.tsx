import Link from "next/link";
import type { Route } from "next";
import { ToolIcon } from "@/components/site/ToolIcon";
import { CATEGORY_THEME } from "@/config/category-theme";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ToolCard } from "@/components/tools/ToolCard";
import type { CategoryDef } from "@/config/site";
import { TOOLS, type ToolDef } from "@/config/tools";

function ToolGrid({ id, title, tools }: { id: string; title: string; tools: ToolDef[] }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="font-heading text-navy mb-5 text-2xl font-extrabold tracking-tight">
        {title}
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((t) => (
          <li key={t.slug}>
            <ToolCard tool={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Category page for the tool categories: hero plus the category's tools (live first, then "Soon"). */
export function ToolCategoryPage({ category }: { category: CategoryDef }) {
  const inCategory = TOOLS.filter((t) => t.categorySlug === category.slug);
  const live = inCategory.filter((t) => t.status === "live");
  const soon = inCategory.filter((t) => t.status !== "live");
  const others = TOOLS.filter((t) => t.status === "live" && t.categorySlug !== category.slug).slice(0, 3);

  return (
    <>
      <section className="tool-wash pt-6 pb-10 sm:pt-8 sm:pb-14">
        <div className="site-container">
          <Breadcrumbs
            items={[{ name: "Home", href: "/" }, { name: "Tools", href: "/tools" as Route }, { name: category.name }]}
          />
          <header className="mt-5 flex items-start gap-4 sm:gap-6">
            <span
              className="grid size-[4.5rem] shrink-0 place-items-center rounded-3xl ring-1 ring-black/[0.05] sm:size-28"
              style={{
                background: `linear-gradient(145deg, #fff 0%, ${CATEGORY_THEME[category.slug].tint} 100%)`,
                boxShadow: `0 14px 30px -12px ${CATEGORY_THEME[category.slug].base}80, inset 0 1px 0 #fff`,
              }}
            >
              <ToolIcon kind={category.iconKey} category={category.slug} size={96} fluid className="size-14 drop-shadow-sm sm:size-[5.5rem]" />
            </span>
            <div className="min-w-0">
              <h1 className="font-heading text-navy text-[1.75rem] leading-[1.12] font-extrabold tracking-tight sm:text-4xl lg:text-[2.6rem]">
                {category.name}
              </h1>
              <p className="text-slate-ink mt-2.5 max-w-3xl text-[0.95rem] leading-relaxed sm:mt-3 sm:text-lg">
                {category.description}
              </p>
              <p className="text-primary-dark bg-primary-soft mt-4 inline-block rounded-full px-3.5 py-1 text-sm font-bold">
                {live.length} {live.length === 1 ? "free tool" : "free tools"} available
                {soon.length > 0 && `, ${soon.length} coming soon`}
              </p>
            </div>
          </header>
        </div>
      </section>

      <div className="site-container space-y-12 py-10 sm:py-14">
        {live.length > 0 ? (
          <ToolGrid id="cat-live" title="Tools in this category" tools={live} />
        ) : (
          <p className="text-slate-ink rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
            The first tools in this category are being built. Browse the{" "}
            <Link href={"/tools" as Route} className="text-primary font-semibold underline">
              tools that are ready
            </Link>{" "}
            in the meantime.
          </p>
        )}
        {soon.length > 0 && <ToolGrid id="cat-soon" title="Coming soon" tools={soon} />}
        {live.length === 0 && others.length > 0 && <ToolGrid id="cat-others" title="Popular free tools" tools={others} />}
      </div>
    </>
  );
}
