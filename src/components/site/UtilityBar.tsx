import Link from "next/link";
import type { Route } from "next";
import { SocialLinks } from "./SocialLinks";
import type { SocialPlatform } from "@/config/site";

/**
 * Top utility bar (spec §6). Dark, ~34px. Date · Trending ticker · social +
 * Sign In + Subscribe. Heavily simplified on mobile — no horizontal overflow.
 * Pure server component, zero client JS.
 */
export function UtilityBar({
  todayLabel,
  ticker,
  social,
}: {
  todayLabel: string;
  ticker: { title: string; href: Route } | null;
  social: Partial<Record<SocialPlatform, string>>;
}) {
  return (
    <div className="bg-ink text-white/80">
      <div className="site-container flex h-9 items-center justify-between gap-4 text-[0.78rem]">
        {/* Date — desktop only */}
        <span className="hidden shrink-0 md:block">{todayLabel}</span>

        {/* Trending ticker */}
        {ticker ? (
          <p className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden">
            <span className="text-brand shrink-0 font-bold tracking-wide uppercase">
              Trending
            </span>
            <Link
              href={ticker.href}
              className="min-w-0 truncate text-white transition-colors hover:text-white/70"
            >
              {ticker.title}
            </Link>
          </p>
        ) : (
          <span className="flex-1" />
        )}

        {/* Right cluster */}
        <div className="flex shrink-0 items-center gap-3">
          <SocialLinks
            links={social}
            size={15}
            className="hidden lg:flex"
            linkClassName="text-white/70 hover:text-white"
          />
          <Link
            href={"/sign-in" as Route}
            className="hidden text-white/80 transition-colors hover:text-white sm:inline"
          >
            Sign In
          </Link>
          <Link
            href={"/subscribe" as Route}
            className="bg-brand text-ink hover:bg-brand-strong rounded-sm px-3 py-1 text-[0.75rem] font-bold transition-colors"
          >
            Subscribe
          </Link>
        </div>
      </div>
    </div>
  );
}
