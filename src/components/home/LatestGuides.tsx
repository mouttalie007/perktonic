import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import type { ArticleCard } from "@/services/article.service";
import { CATEGORIES } from "@/config/site";
import { ToolIcon } from "@/components/site/ToolIcon";
import { CardArrow, SectionHeading } from "./SectionHeading";

/** "Latest Guides & Resources": the 4 newest published articles (hidden when there are none). */
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
      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {articles.map((a) => {
          const cat = CATEGORIES.find((c) => c.slug === a.category?.slug);
          return (
            <li key={a.id}>
              <Link
                href={`/story/${a.slug}` as Route}
                className="group relative flex h-full items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-3 pr-4 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-soft-hover)] lg:p-4"
              >
                <span className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-xl bg-slate-100 lg:h-24 lg:w-24">
                  {a.featuredImage ? (
                    <Image
                      src={a.featuredImage.url}
                      alt={a.featuredImage.alt ?? ""}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center">
                      <ToolIcon kind={cat?.iconKey ?? "globe"} size={44} />
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading text-navy line-clamp-3 text-[0.95rem] leading-snug font-bold">
                    {a.title}
                  </h3>
                  {a.category && (
                    <span className="text-primary bg-primary-soft mt-2 inline-block rounded-full px-3 py-1 text-[0.75rem] font-medium">
                      {a.category.name}
                    </span>
                  )}
                </div>
                <CardArrow className="hidden sm:inline-flex lg:absolute lg:right-4 lg:bottom-4" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
