import Link from "next/link";
import type { Route } from "next";
import type { ArticleCard } from "@/services/article.service";
import { TrendingList } from "@/components/home/TrendingList";
import { NewsletterSidebarCTA } from "@/components/article/NewsletterSidebarCTA";
import { AdSlot } from "@/components/ads/AdSlot";
import { popularTools, toolHref } from "@/config/tools";
import { blogUrl } from "./BlogControls";

/**
 * Right-hand column of the blog index: newsletter signup, the most read guides,
 * the free tools, and a category shortcut list.
 */
export function BlogSidebar({
  popular,
  title,
  categories,
}: {
  popular: ArticleCard[];
  title: string;
  categories: { slug: string; name: string; count: number; color: string | null }[];
}) {
  const tools = popularTools().slice(0, 5);
  return (
    <aside aria-label="Sidebar" className="space-y-6 lg:sticky lg:top-6 lg:self-start">
      <NewsletterSidebarCTA
        title="Get new guides by email"
        text="One short email when a new guide or tool is published. No spam, unsubscribe anytime."
      />

      <TrendingList stories={popular} title={title} />

      <section aria-label="Free tools" className="border-line bg-canvas rounded-sm border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-extrabold tracking-[0.12em] uppercase">Free tools</h2>
          <Link href={"/tools" as Route} className="text-muted hover:text-ink text-xs font-semibold">
            See all
          </Link>
        </div>
        <ul className="divide-line divide-y">
          {tools.map((t) => (
            <li key={t.slug}>
              <Link
                href={toolHref(t) as Route}
                className="group block py-2.5 first:pt-0 last:pb-0"
              >
                <span className="text-ink group-hover:text-ink/70 block text-[0.86rem] leading-snug font-bold">
                  {t.name}
                </span>
                <span className="text-muted mt-0.5 line-clamp-2 block text-xs leading-snug">
                  {t.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Categories" className="border-line bg-canvas rounded-sm border p-4">
        <h2 className="mb-3 text-sm font-extrabold tracking-[0.12em] uppercase">Browse by topic</h2>
        <ul className="space-y-1.5">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link
                href={blogUrl({ cat: c.slug })}
                className="text-ink hover:bg-surface flex items-center gap-2 rounded-sm px-1.5 py-1 text-[0.86rem] font-semibold"
              >
                {c.color && (
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                )}
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="text-muted text-xs tabular-nums">{c.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <AdSlot placement="sidebar" />
    </aside>
  );
}
