import type { Metadata } from "next";
import { CATEGORIES } from "@/config/site";
import { TOOLS } from "@/config/tools";
import { ToolsExplorer } from "@/components/tools/ToolsExplorer";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export const metadata: Metadata = {
  title: "Free Online Tools",
  description:
    "Free online tools for spreadsheets, data conversion, documents, automation and web diagnostics: browse every PerkTonic tool by category.",
  alternates: { canonical: "/tools" },
};

const FACTS = [
  { value: `${TOOLS.length}`, label: "free tools" },
  { value: `${CATEGORIES.length}`, label: "categories" },
  { value: "0", label: "sign-ups needed" },
];

/** Tools hub: a hero, a category filter with search, and every tool grouped by category. */
export default function ToolsHubPage() {
  return (
    <>
      <section className="tool-wash relative overflow-hidden pt-6 pb-10 sm:pt-8 sm:pb-14">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <span className="absolute -top-24 right-[8%] h-72 w-72 rounded-full bg-[#7C3AED]/10 blur-3xl" />
          <span className="absolute top-10 right-[28%] h-56 w-56 rounded-full bg-[#E0A800]/15 blur-3xl" />
          <span className="absolute -bottom-20 left-[6%] h-64 w-64 rounded-full bg-[#2563EB]/10 blur-3xl" />
        </div>
        <div className="site-container relative">
          <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Tools" }]} />
          <header className="mt-5 max-w-3xl">
            <h1 className="font-heading text-navy text-3xl font-extrabold tracking-tight sm:text-5xl">
              Every tool, one place
            </h1>
            <p className="text-slate-ink mt-3 text-lg leading-relaxed">
              Free tools for spreadsheets, data, documents, automation and the web.
              Most run in your browser, so your files stay on your computer.
            </p>
            <dl className="mt-6 flex flex-wrap gap-3">
              {FACTS.map((f) => (
                <div
                  key={f.label}
                  className="flex items-baseline gap-2 rounded-full bg-white/80 px-4 py-2 shadow-[var(--shadow-soft)] ring-1 ring-slate-900/[0.05] backdrop-blur"
                >
                  <dd className="font-heading text-navy text-xl font-extrabold">{f.value}</dd>
                  <dt className="text-sm text-slate-600">{f.label}</dt>
                </div>
              ))}
            </dl>
          </header>
        </div>
      </section>

      <ToolsExplorer tools={TOOLS} categories={CATEGORIES} />
    </>
  );
}
