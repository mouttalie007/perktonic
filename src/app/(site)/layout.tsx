import type { ReactNode } from "react";
import type { Route } from "next";
import { siteSettingsService } from "@/services/site-settings.service";
import { trendingService } from "@/services/trending.service";
import { UtilityBar } from "@/components/site/UtilityBar";
import { HeaderBar } from "@/components/site/HeaderBar";
import { SiteFooter } from "@/components/site/SiteFooter";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

/**
 * Public site chrome (spec §96): utility bar, header/nav, footer. The admin
 * area (Phase 7) lives outside this group with its own layout.
 */
export default async function SiteLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [social, ticker] = await Promise.all([
    siteSettingsService.getSocialLinks(),
    trendingService.getTicker(),
  ]);

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <UtilityBar
        todayLabel={dateFmt.format(new Date())}
        ticker={
          ticker
            ? { title: ticker.title, href: `/story/${ticker.slug}` as Route }
            : null
        }
        social={social}
      />
      <HeaderBar social={social} />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter social={social} />
    </>
  );
}
