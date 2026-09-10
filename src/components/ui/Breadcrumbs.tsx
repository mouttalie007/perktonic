import Link from "next/link";
import type { Route } from "next";

export interface Crumb {
  name: string;
  href?: Route;
}

/**
 * Visible breadcrumb trail (spec §71). The matching BreadcrumbList JSON-LD is
 * emitted by the page via seoService.breadcrumbJsonLd().
 */
export function Breadcrumbs({
  items,
  className = "",
}: {
  items: Crumb[];
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="text-muted flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.78rem]">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-2">
              {item.href && !last ? (
                <Link href={item.href} className="hover:text-ink transition-colors">
                  {item.name}
                </Link>
              ) : (
                <span className={last ? "text-ink line-clamp-1" : undefined} aria-current={last ? "page" : undefined}>
                  {item.name}
                </span>
              )}
              {!last && <span aria-hidden>/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
