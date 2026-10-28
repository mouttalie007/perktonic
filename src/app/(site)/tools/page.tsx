import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { CATEGORIES } from "@/config/site";
import { TOOLS, toolHref } from "@/config/tools";
import { ToolIcon } from "@/components/site/ToolIcon";
import { CardArrow } from "@/components/home/SectionHeading";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export const metadata: Metadata = {
  title: "Free Online Tools",
  description:
    "Free online tools for spreadsheets, data conversion, documents, automation and web diagnostics: browse every PerkTonic tool by category.",
  alternates: { canonical: "/tools" },
};

/** Tools hub: every tool grouped by category, with a "Soon" badge on the ones still being built. */
export default function ToolsHubPage() {
  return (
    <div className="site-container py-8 sm:py-12">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Tools" }]} />
      <header className="mt-4 max-w-3xl">
        <h1 className="font-heading text-navy text-3xl font-extrabold tracking-tight sm:text-4xl">
          All Tools
        </h1>
        <p className="text-slate-ink mt-2 text-lg">
          Free tools for spreadsheets, data, documents, automation and the web.
          New tools are added regularly.
        </p>
      </header>

      <div className="mt-10 space-y-12">
        {CATEGORIES.map((c) => {
          const tools = TOOLS.filter((t) => t.categorySlug === c.slug);
          return (
            <section key={c.slug} aria-labelledby={`cat-${c.slug}`}>
              <div className="mb-4 flex items-center gap-3">
                <ToolIcon kind={c.iconKey} size={44} />
                <div>
                  <h2
                    id={`cat-${c.slug}`}
                    className="font-heading text-navy text-xl font-bold"
                  >
                    <Link
                      href={`/category/${c.slug}` as Route}
                      className="hover:underline"
                    >
                      {c.name}
                    </Link>
                  </h2>
                  <p className="text-slate-ink text-sm">{c.shortDescription}</p>
                </div>
              </div>
              {tools.length === 0 ? (
                <p className="text-slate-ink rounded-2xl border border-dashed border-slate-300 p-5 text-sm">
                  Tools for this category are on the way.
                </p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {tools.map((t) => (
                    <li key={t.slug}>
                      <Link
                        href={toolHref(t) as Route}
                        className="group relative flex h-full items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 pr-5 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-soft-hover)]"
                      >
                        <ToolIcon kind={t.iconKey} size={48} />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-heading text-navy flex flex-wrap items-center gap-2 text-[0.98rem] font-bold">
                            {t.name}
                            {t.status === "soon" && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.68rem] font-bold tracking-wide text-amber-800 uppercase">
                                Soon
                              </span>
                            )}
                          </h3>
                          <p className="text-slate-ink mt-0.5 text-sm leading-snug">
                            {t.description}
                          </p>
                        </div>
                        <CardArrow />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
