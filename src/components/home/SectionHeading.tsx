import Link from "next/link";
import type { Route } from "next";
import { ArrowRightIcon } from "@/components/icons";

/** Section title row used on the homepage: heading (+ optional subtitle) and a "View all →" link. */
export function SectionHeading({
  title,
  subtitle,
  href,
  linkLabel,
  linkLabelExtra,
  id,
}: {
  title: string;
  subtitle?: string;
  href: string;
  linkLabel: string;
  /** Extra words shown after the label from the sm breakpoint up (e.g. "Articles"). */
  linkLabelExtra?: string;
  id: string;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2
          id={id}
          className="font-heading text-navy text-[1.2rem] leading-tight font-extrabold tracking-tight sm:text-[1.65rem]"
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-slate-ink mt-1 text-[0.95rem]">{subtitle}</p>
        )}
      </div>
      <Link
        href={href as Route}
        className="text-primary hover:text-primary-dark inline-flex shrink-0 items-center gap-1.5 text-[0.9rem] font-semibold"
      >
        <span>
          {linkLabel}
          {linkLabelExtra && (
            <span className="hidden sm:inline"> {linkLabelExtra}</span>
          )}
        </span>
        <ArrowRightIcon width={16} height={16} />
      </Link>
    </div>
  );
}

/** The small round arrow at the bottom-right of a card. */
export function CardArrow({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`text-primary border-primary/25 group-hover:bg-primary group-hover:border-primary inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-white transition-colors group-hover:text-white ${className}`}
    >
      <ArrowRightIcon width={15} height={15} />
    </span>
  );
}
