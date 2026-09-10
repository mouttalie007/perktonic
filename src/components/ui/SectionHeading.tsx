import Link from "next/link";
import type { Route } from "next";
import { ArrowRightIcon } from "@/components/icons";

/**
 * Section heading with the brand yellow vertical accent and an optional
 * "View All →" link (spec §14).
 */
export function SectionHeading({
  title,
  href,
  linkLabel = "View All",
  as = "h2",
  className = "",
}: {
  title: string;
  href?: Route;
  linkLabel?: string;
  as?: "h2" | "h3";
  className?: string;
}) {
  const Tag = as;
  return (
    <div className={`mb-5 flex items-end justify-between gap-4 ${className}`}>
      <Tag className="flex items-center gap-3 text-xl font-extrabold tracking-tight sm:text-2xl">
        <span className="bg-brand inline-block h-6 w-1.5 rounded-full" aria-hidden />
        {title}
      </Tag>
      {href && (
        <Link
          href={href}
          className="text-muted hover:text-ink group inline-flex shrink-0 items-center gap-1 text-sm font-semibold transition-colors"
        >
          {linkLabel}
          <ArrowRightIcon
            width={15}
            height={15}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      )}
    </div>
  );
}
