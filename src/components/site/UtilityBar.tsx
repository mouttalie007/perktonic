import Link from "next/link";
import type { Route } from "next";
import { SocialLinks } from "./SocialLinks";
import type { SocialPlatform } from "@/config/site";

/**
 * Top utility bar (spec §6). Dark, ~34px. Date · Trending ticker · social.
 * Heavily simplified on mobile — no horizontal overflow. Pure server
 * component, zero client JS.
 *
 * Sign In / Subscribe links removed 2026-10-11 -- there is no public reader
 * account system in this product (admin-only CMS), and no single newsletter
 * page/anchor exists on every route to point Subscribe at (it's already a
 * prominent CTA in article/category sidebars). Both linked to 404s.
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
        </div>
      </div>
    </div>
  );
}
