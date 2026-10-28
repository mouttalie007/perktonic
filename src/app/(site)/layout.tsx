import type { ReactNode } from "react";
import type { Metadata } from "next";
import { ADSENSE_PUBLISHER } from "@/config/ads";
import { siteSettingsService } from "@/services/site-settings.service";
import { HeaderBar } from "@/components/site/HeaderBar";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ConsentBanner } from "@/components/consent/ConsentBanner";
import { AnalyticsScripts } from "@/components/consent/AnalyticsScripts";

// Second AdSense ownership signal (the meta-tag method); loads nothing by itself.
export const metadata: Metadata = {
  other: { "google-adsense-account": ADSENSE_PUBLISHER.client },
};

/**
 * Public site chrome: header/nav, footer. The admin area lives outside this
 * group with its own layout. (The old date/ticker utility bar was removed in
 * the 2026-10-29 tools redesign.)
 */
export default async function SiteLayout({
  children,
}: {
  children: ReactNode;
}) {
  const social = await siteSettingsService.getSocialLinks();

  return (
    <>
      {/* AdSense site-verification snippet. A raw async script (React hoists it
          into <head>) because the AdSense crawler reads the HTML source and
          does not run our consent-gated loader. Public pages only: the admin
          area uses a different layout and loads no third-party scripts. */}
      <script
        async
        src={ADSENSE_PUBLISHER.scriptSrc}
        crossOrigin="anonymous"
        suppressHydrationWarning
      />
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <HeaderBar />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter social={social} />
      <ConsentBanner />
      <AnalyticsScripts />
    </>
  );
}
