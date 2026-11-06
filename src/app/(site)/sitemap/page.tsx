import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { articleService } from "@/services/article.service";
import { seoService } from "@/services/seo.service";
import { CATEGORIES } from "@/config/site";
import { TOOLS, toolHref } from "@/config/tools";
import { CATEGORY_THEME } from "@/config/category-theme";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

/** The visitor's map of the site; the machine-readable one is /sitemap.xml (sent to Search Console). */
export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return seoService.buildMetadata({
    title: "Sitemap: every tool, guide and page",
    description:
      "A complete, ordered list of the PerkTonic tools by category, every published guide, the topic pages and the company and legal pages.",
    path: "/sitemap",
  });
}

const COMPANY: { label: string; href: string }[] = [
  { label: "About Us", href: "/about" },
  { label: "Editorial Policy", href: "/editorial-policy" },
  { label: "Contact", href: "/contact" },
  { label: "Write for Us", href: "/write-for-us" },
  { label: "Advertise", href: "/advertise" },
];
const LEGAL: { label: string; href: string }[] = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms of Service", href: "/terms-of-service" },
  { label: "Cookie Policy", href: "/cookie-policy" },
  { label: "Disclaimer", href: "/disclaimer" },
  { label: "Affiliate Disclosure", href: "/affiliate-disclosure" },
  { label: "DMCA & Copyright", href: "/dmca" },
  { label: "Accessibility", href: "/accessibility" },
];

export default async function SitemapPage() {
  const articles = await articleService.listAllCards();
  const live = TOOLS.filter((t) => t.status === "live");
  const link = "text-slate-ink hover:text-primary text-[0.95rem] leading-snug transition-colors";
  const h2 = "font-heading text-navy text-xl font-extrabold tracking-tight";

  return (
    <div className="site-container py-10 sm:py-14">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Sitemap" }]} />
      <h1 className="font-heading text-navy mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Sitemap</h1>
      <p className="text-slate-ink mt-3 max-w-2xl text-lg leading-relaxed">
        Everything on PerkTonic in one place: {live.length} free tools in {CATEGORIES.length} categories, {articles.length}{" "}
        guides, and the company and legal pages. Search engines can read the{" "}
        <a href="/sitemap.xml" className="text-primary underline">XML sitemap</a>; new guides also appear in the{" "}
        <a href="/feed.xml" className="text-primary underline">RSS feed</a>.
      </p>

      <section aria-labelledby="sm-tools" className="mt-12">
        <h2 id="sm-tools" className={h2}>
          Tools
        </h2>
        <p className="mt-1">
          <Link href={"/tools" as Route} className="text-primary text-sm font-semibold">All tools →</Link>
        </p>
        <div className="mt-6 grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => {
            const list = live.filter((t) => t.categorySlug === c.slug);
            return (
              <div key={c.slug}>
                <h3 className="font-heading text-navy flex items-center gap-2 text-base font-bold">
                  <span aria-hidden className="size-2.5 rounded-full" style={{ background: CATEGORY_THEME[c.slug].base }} />
                  <Link href={`/category/${c.slug}` as Route} className="hover:text-primary">{c.name}</Link>
                </h3>
                <ul className="mt-3 space-y-2">
                  {list.map((t) => (
                    <li key={t.slug}>
                      <Link href={toolHref(t) as Route} className={link}>{t.name}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="sm-guides" className="mt-14">
        <h2 id="sm-guides" className={h2}>
          Guides
        </h2>
        <p className="mt-1">
          <Link href={"/blog" as Route} className="text-primary text-sm font-semibold">All guides →</Link>
        </p>
        <div className="mt-6 grid gap-x-8 gap-y-10 md:grid-cols-2">
          {CATEGORIES.map((c) => {
            const list = articles.filter((a) => a.category?.slug === c.slug);
            if (list.length === 0) return null;
            return (
              <div key={c.slug}>
                <h3 className="font-heading text-navy flex items-center gap-2 text-base font-bold">
                  <span aria-hidden className="size-2.5 rounded-full" style={{ background: CATEGORY_THEME[c.slug].base }} />
                  {c.name} <span className="text-slate-500 text-sm font-medium">({list.length})</span>
                </h3>
                <ul className="mt-3 space-y-2">
                  {list.map((a) => (
                    <li key={a.id}>
                      <Link href={`/blog/${a.slug}` as Route} className={link}>{a.title}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-14 grid gap-10 sm:grid-cols-2">
        <section aria-labelledby="sm-company">
          <h2 id="sm-company" className={h2}>Company</h2>
          <ul className="mt-3 space-y-2">
            {COMPANY.map((l) => (
              <li key={l.href}><Link href={l.href as Route} className={link}>{l.label}</Link></li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="sm-legal">
          <h2 id="sm-legal" className={h2}>Legal</h2>
          <ul className="mt-3 space-y-2">
            {LEGAL.map((l) => (
              <li key={l.href}><Link href={l.href as Route} className={link}>{l.label}</Link></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
