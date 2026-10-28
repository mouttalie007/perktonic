import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { CATEGORIES } from "@/config/site";
import { toolBySlug } from "@/config/tools";
import { ToolIcon } from "@/components/site/ToolIcon";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

type Params = { params: Promise<{ slug: string }> };

/**
 * Placeholder for a tool that is not built yet. A finished tool gets its own
 * `tools/<slug>/page.tsx`, which takes precedence over this dynamic route.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const tool = toolBySlug(slug);
  if (!tool) return { title: "Tool not found" };
  return {
    title: tool.name,
    description: tool.description,
    robots: { index: false, follow: true },
  };
}

export default async function ToolPlaceholderPage({ params }: Params) {
  const { slug } = await params;
  const tool = toolBySlug(slug);
  if (!tool) notFound();
  const category = CATEGORIES.find((c) => c.slug === tool.categorySlug);

  return (
    <div className="site-container py-8 sm:py-12">
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Tools", href: "/tools" as Route },
          { name: tool.name },
        ]}
      />
      <div className="mx-auto mt-10 max-w-2xl rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-[var(--shadow-soft)] sm:p-12">
        <ToolIcon kind={tool.iconKey} size={72} className="mx-auto" />
        <h1 className="font-heading text-navy mt-5 text-3xl font-extrabold tracking-tight">
          {tool.name}
        </h1>
        <p className="text-slate-ink mt-2 text-lg">{tool.description}</p>
        <p className="mt-6 inline-block rounded-full bg-amber-100 px-4 py-1.5 text-sm font-bold text-amber-800">
          This tool is being built. Coming soon.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={"/tools" as Route}
            className="bg-primary hover:bg-primary-dark rounded-xl px-5 py-2.5 text-sm font-bold text-white"
          >
            Browse all tools
          </Link>
          {category && (
            <Link
              href={`/category/${category.slug}` as Route}
              className="text-navy rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold hover:bg-slate-50"
            >
              More in {category.name}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
