import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { CATEGORIES } from "@/config/site";
import { TOOLS, toolBySlug, toolHref } from "@/config/tools";
import { ToolIcon } from "@/components/site/ToolIcon";
import { JsonLd } from "@/components/seo/JsonLd";
import { ToolBadges, ToolHero } from "@/components/tools/ToolHero";
import { ToolFaq } from "@/components/tools/ToolFaq";
import { ToolProse } from "@/components/tools/ToolProse";
import { ToolStage } from "@/components/tools/ToolStage";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { getToolContent } from "@/lib/tool-content";
import { seoService } from "@/services/seo.service";
import { ToolRunner } from "@/tools/ToolRunner";
import { TOOL_SLUGS } from "@/tools/slugs";

type Params = { params: Promise<{ slug: string }> };

/**
 * One route for every tool. A live tool (status "live" + a component in
 * src/tools/registry.tsx) gets its interactive page with the copy from its
 * content.md; a tool that is not built yet gets the "coming soon" placeholder.
 */
const isLive = (slug: string) => toolBySlug(slug)?.status === "live" && TOOL_SLUGS.has(slug);

export function generateStaticParams() {
  return TOOLS.filter((t) => isLive(t.slug)).map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const tool = toolBySlug(slug);
  if (!tool) return { title: "Tool not found" };
  if (!isLive(slug)) {
    return { title: tool.name, description: tool.description, robots: { index: false, follow: true } };
  }
  const { meta } = getToolContent(slug);
  return seoService.buildMetadata({
    title: meta.title,
    description: meta.metaDescription,
    path: toolHref(tool),
    robotsIndex: true,
  });
}

export default async function ToolPage({ params }: Params) {
  const { slug } = await params;
  const tool = toolBySlug(slug);
  if (!tool) notFound();
  const category = CATEGORIES.find((c) => c.slug === tool.categorySlug);

  if (!isLive(slug)) return <ComingSoon slug={slug} />;

  const { meta, hero, sections, faq } = getToolContent(slug);
  const related = (meta.relatedSlugs ?? [])
    .map((s) => toolBySlug(s))
    .filter((t): t is NonNullable<typeof t> => !!t && isLive(t.slug));

  const jsonLd = [
    seoService.breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Tools", path: "/tools" },
      ...(category ? [{ name: category.name, path: `/category/${category.slug}` }] : []),
      { name: tool.name, path: toolHref(tool) },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: meta.h1,
      url: seoService.absoluteUrl(toolHref(tool)),
      description: meta.metaDescription,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any (runs in the browser)",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    ...(faq.length
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map((f) => ({
              "@type": "Question",
              name: f.question,
              acceptedAnswer: { "@type": "Answer", text: f.answer },
            })),
          },
        ]
      : []),
  ];

  const moreTools = [
    ...related,
    ...TOOLS.filter((t) => isLive(t.slug) && t.slug !== slug && t.categorySlug === tool.categorySlug),
    ...TOOLS.filter((t) => isLive(t.slug) && t.slug !== slug),
  ]
    .filter((t, i, all) => all.findIndex((x) => x.slug === t.slug) === i)
    .slice(0, 4);

  return (
    <>
      {jsonLd.map((d, i) => (
        <JsonLd key={i} data={d} />
      ))}

      <section className="tool-wash pt-6 pb-8 sm:pt-8 sm:pb-12">
        <div className="site-container">
          <Breadcrumbs
            items={[
              { name: "Home", href: "/" },
              { name: "Tools", href: "/tools" as Route },
              ...(category ? [{ name: category.name, href: `/category/${category.slug}` as Route }] : []),
              { name: tool.name },
            ]}
          />
          <ToolHero iconKey={tool.iconKey} slug={tool.slug} categorySlug={tool.categorySlug} h1={meta.h1} intro={hero} />
          <ToolBadges serverSide={tool.serverSide} ai={tool.ai} badge={tool.badge} />

          <ToolStage className="tool-stage mt-7 rounded-[1.75rem] bg-white/55 p-2 ring-1 ring-primary/10 backdrop-blur-sm sm:mt-9 sm:rounded-[2rem] sm:p-5 lg:p-6">
            <ToolRunner slug={slug} />
          </ToolStage>
        </div>
      </section>

      <div className="site-container py-12 sm:py-16 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
        <div className="max-w-3xl min-w-0 space-y-12">
          {sections.map((s) => {
            const id = `sec-${s.title.replace(/\W+/g, "-").toLowerCase()}`;
            const isFaq = /^faq$/i.test(s.title);
            const isHow = /^how to use/i.test(s.title);
            return (
              <section
                key={s.title}
                aria-labelledby={id}
                className={isHow ? "bg-primary-soft/55 rounded-3xl p-5 ring-1 ring-primary/10 sm:p-8" : undefined}
              >
                <h2
                  id={id}
                  className="font-heading text-navy mb-5 flex items-center gap-3 text-2xl font-extrabold tracking-tight"
                >
                  <span aria-hidden className="from-primary h-6 w-1.5 rounded-full bg-gradient-to-b to-violet-500" />
                  {s.title}
                </h2>
                {isFaq ? <ToolFaq items={faq} /> : <ToolProse markdown={s.body} />}
              </section>
            );
          })}
        </div>

        <aside aria-label="More tools" className="mt-14 min-w-0 lg:mt-0">
          <div className="space-y-5 lg:sticky lg:top-24">
            <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-soft)] ring-1 ring-slate-900/[0.06]">
              <h2 className="font-heading text-navy text-lg font-extrabold">More free tools</h2>
              <ul className="mt-3 space-y-1">
                {moreTools.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={toolHref(r) as Route}
                      className="hover:bg-primary-soft/70 -mx-2 flex items-center gap-3 rounded-2xl p-2 transition-colors"
                    >
                      <ToolIcon kind={r.iconKey} slug={r.slug} size={36} />
                      <span className="min-w-0">
                        <span className="text-navy block text-sm leading-snug font-bold">{r.name}</span>
                        <span className="text-slate-ink line-clamp-2 block text-xs leading-snug">{r.description}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="from-primary rounded-3xl bg-gradient-to-br to-[#3a2cd8] p-5 text-white shadow-[0_18px_40px_-18px_rgba(11,92,255,0.8)]">
              <h2 className="font-heading text-lg font-extrabold">Free, fast and private</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-white/85">
                Every PerkTonic tool is free, needs no account and keeps your data on your device wherever it can.
              </p>
              <Link
                href={"/tools" as Route}
                className="text-primary-dark mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-bold transition hover:bg-white/90"
              >
                Browse all tools <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

async function ComingSoon({ slug }: { slug: string }) {
  const tool = toolBySlug(slug)!;
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
        <ToolIcon kind={tool.iconKey} slug={tool.slug} size={80} className="mx-auto" />
        <h1 className="font-heading text-navy mt-5 text-3xl font-extrabold tracking-tight">{tool.name}</h1>
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
