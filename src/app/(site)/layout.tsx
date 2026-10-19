import type { ReactNode } from "react";
import type { Metadata, Route } from "next";
import { ADSENSE_PUBLISHER } from "@/config/ads";
import { siteSettingsService } from "@/services/site-settings.service";
import { trendingService } from "@/services/trending.service";
import { UtilityBar } from "@/components/site/UtilityBar";
import { HeaderBar } from "@/components/site/HeaderBar";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ConsentBanner } from "@/components/consent/ConsentBanner";
import { AnalyticsScripts } from "@/components/consent/AnalyticsScripts";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

// Second AdSense ownership signal (the meta-tag method); loads nothing by itself.
export const metadata: Metadata = {
  other: { "google-adsense-account": ADSENSE_PUBLISHER.client },
};

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
      {/* AdSense site-verification snippet. A raw async script (React hoists it
          into <head>) because the AdSense crawler reads the HTML source and
          does not run our consent-gated loader. Public pages only: the admin
          area uses a different layout and loads no third-party scripts. */}
      <script async src={ADSENSE_PUBLISHER.scriptSrc} crossOrigin="anonymous" />
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
      <ConsentBanner />
      <AnalyticsScripts />
    </>
  );
}
