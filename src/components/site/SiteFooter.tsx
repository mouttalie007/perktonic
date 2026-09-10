import Link from "next/link";
import type { Route } from "next";
import { CATEGORIES, type SocialPlatform } from "@/config/site";
import { Logo } from "./Logo";
import { SocialLinks } from "./SocialLinks";

/**
 * Site footer (spec §19, §74). Dark. Every link resolves — no dead links.
 * Content is static config now; becomes SiteSettings/Page-driven in Phase 7.
 */

const QUICK_LINKS: { label: string; href: Route }[] = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about" as Route },
  { label: "Contact", href: "/contact" as Route },
  { label: "Privacy Policy", href: "/privacy-policy" as Route },
  { label: "Terms of Service", href: "/terms-of-service" as Route },
  { label: "Sitemap", href: "/sitemap" as Route },
];

const RESOURCES: { label: string; href: Route }[] = [
  { label: "Write for Us", href: "/write-for-us" as Route },
  { label: "Advertise", href: "/advertise" as Route },
  { label: "Editorial Policy", href: "/editorial-policy" as Route },
  { label: "RSS Feed", href: "/feed.xml" as Route },
];

const BOTTOM_LINKS: { label: string; href: Route }[] = [
  { label: "Cookie Policy", href: "/cookie-policy" as Route },
  { label: "Disclaimer", href: "/disclaimer" as Route },
  { label: "Accessibility", href: "/accessibility" as Route },
];

const FOOTER_CATEGORIES = CATEGORIES.filter((c) =>
  ["viral", "people", "tech", "lifestyle", "entertainment", "travel", "health", "amazing"].includes(
    c.slug,
  ),
);

function Column({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: Route }[];
}) {
  return (
    <div>
      <h2 className="text-meta mb-3 font-bold tracking-[0.18em] text-white uppercase">
        {title}
      </h2>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-sm text-white/60 transition-colors hover:text-white"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter({
  social,
}: {
  social: Partial<Record<SocialPlatform, string>>;
}) {
  return (
    <footer className="bg-ink-deep mt-16 text-white">
      <div className="site-container py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo onDark />
            <p className="text-meta mt-2 font-semibold tracking-[0.2em] text-white/50 uppercase">
              Trend Today. Talk Tomorrow.
            </p>
            <p className="mt-4 max-w-xs text-sm text-white/60">
              ViralTrendly brings you the most interesting, inspiring and
              trending stories from around the world.
            </p>
            <SocialLinks
              links={social}
              size={18}
              className="mt-5"
              linkClassName="text-white/60 hover:text-white"
            />
          </div>

          <Column title="Quick Links" links={QUICK_LINKS} />
          <Column
            title="Categories"
            links={FOOTER_CATEGORIES.map((c) => ({
              label: c.name,
              href: `/category/${c.slug}` as Route,
            }))}
          />
          <Column title="Resources" links={RESOURCES} />
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="site-container flex flex-col items-center justify-between gap-3 py-5 text-xs text-white/50 sm:flex-row">
          <p>© {new Date().getFullYear()} ViralTrendly.com. All rights reserved.</p>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {BOTTOM_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="transition-colors hover:text-white"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
