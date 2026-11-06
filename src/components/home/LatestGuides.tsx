import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import type { ArticleCard } from "@/services/article.service";
import { CATEGORIES } from "@/config/site";
import { ArrowRightIcon } from "@/components/icons";
import { CATEGORY_THEME } from "@/config/category-theme";
import { ToolIcon } from "@/components/site/ToolIcon";
import { SectionHeading } from "./SectionHeading";

/** "Latest Guides & Resources": the newest article of each category, so every colour shows (hidden when there are none). */
export function LatestGuides({ articles }: { articles: ArticleCard[] }) {
  if (articles.length === 0) return null;
  return (
    <section
      aria-labelledby="home-guides"
      className="site-container py-10 sm:py-12"
    >
      <SectionHeading
        id="home-guides"
        title="Latest Guides & Resources"
        subtitle="Learn tips, tutorials and best practices to get more from your tools."
        href="/blog"
        linkLabel="View All"
        linkLabelExtra="Articles"
      />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {articles.map((a, i) => {
          const cat = CATEGORIES.find((c) => c.slug === a.category?.slug);
          return (
            <li key={a.id} className={i === articles.length - 1 && articles.length % 2 === 1 ? "sm:col-span-2 lg:col-span-1" : ""}>
              <Link
                href={`/story/${a.slug}` as Route}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-soft)] ring-1 ring-slate-900/[0.06] transition duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-soft-hover)]"
              >
                <span className="relative block aspect-[1200/630] w-full overflow-hidden bg-slate-100">
                  {a.featuredImage ? (
                    <Image
                      src={a.featuredImage.url}
                      alt={a.featuredImage.alt ?? ""}
                      fill
                      sizes="(min-width: 1024px) 20vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center">
                      <ToolIcon kind={cat?.iconKey ?? "globe"} category={cat?.slug} size={64} />
                    </span>
                  )}
                </span>
                <div className="flex flex-1 flex-col p-4">
                  {a.category && (
                    <span
                      className="mb-2 inline-flex w-fit items-center gap-1.5 text-[0.75rem] font-semibold"
                      style={{ color: cat ? CATEGORY_THEME[cat.slug].deep : undefined }}
                    >
                      <span
                        aria-hidden
                        className="size-2 rounded-full"
                        style={{ background: cat ? CATEGORY_THEME[cat.slug].base : "currentColor" }}
                      />
                      {a.category.name}
                    </span>
                  )}
                  <h3 className="font-heading text-navy line-clamp-3 text-[0.95rem] leading-snug font-bold">
                    {a.title}
                  </h3>
                  <span className="text-primary mt-auto inline-flex items-center gap-1.5 pt-3 text-[0.85rem] font-semibold">
                    Read the guide
                    <ArrowRightIcon width={15} height={15} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
