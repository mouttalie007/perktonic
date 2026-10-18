"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { ADSENSE } from "@/config/ads";
import {
  CONSENT_CHANGED_EVENT,
  DEFAULT_CONSENT,
  readConsentCookieClient,
  type ConsentState,
} from "@/lib/consent";

interface AnalyticsConfig {
  ga4MeasurementId: string;
  gtmContainerId: string;
}
const EMPTY_CONFIG: AnalyticsConfig = {
  ga4MeasurementId: "",
  gtmContainerId: "",
};

/**
 * Consent-gated script loading (Phase 9; admin-editable analytics IDs
 * added 2026-09-13). Deliberately a client component, for two reasons:
 *
 * - Consent: reading the decision cookie via `cookies()` on the server
 *   would mark every page dynamic (any use of that API in the render tree
 *   opts the whole route out of static generation), undoing Phase 6's
 *   static pages for no real benefit. This is also how real-world CMPs
 *   (OneTrust, Cookiebot, etc.) inject analytics/ad scripts: client-side,
 *   gated on a stored decision.
 * - IDs: GA4/GTM IDs are set from the admin (Settings -> SEO -> Analytics)
 *   so they take effect with no redeploy. A plain import of a client env
 *   var would freeze the value into the JS bundle at build time — fetching
 *   `/api/analytics-config` (a tiny, always-fresh route) avoids that.
 *
 * Nothing here renders until the visitor has explicitly granted the
 * matching category, and until the corresponding id is actually set.
 */
export function AnalyticsScripts() {
  const [consent, setConsent] = useState<ConsentState>(DEFAULT_CONSENT);
  const [config, setConfig] = useState<AnalyticsConfig>(EMPTY_CONFIG);

  useEffect(() => {
    // document.cookie (browser-only) can't be read during SSR, so this can
    // only run after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsent(readConsentCookieClient() ?? DEFAULT_CONSENT);

    // A decision saved without a reload (see ConsentBanner) loads the scripts right away.
    const onChanged = () =>
      setConsent(readConsentCookieClient() ?? DEFAULT_CONSENT);
    window.addEventListener(CONSENT_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, onChanged);
  }, []);

  useEffect(() => {
    if (!consent.analytics) return;
    let cancelled = false;
    fetch("/api/analytics-config")
      .then((r) => r.json())
      .then((data: AnalyticsConfig) => {
        if (!cancelled) setConfig(data);
      })
      .catch(() => {
        /* analytics is best-effort; a failed fetch just means no scripts load */
      });
    return () => {
      cancelled = true;
    };
  }, [consent.analytics]);

  const ga4Enabled = consent.analytics && config.ga4MeasurementId.length > 0;
  const gtmEnabled = consent.analytics && config.gtmContainerId.length > 0;

  return (
    <>
      {ga4Enabled && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${config.ga4MeasurementId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${config.ga4MeasurementId}', { anonymize_ip: true });`}
          </Script>
        </>
      )}

      {gtmEnabled && (
        <Script id="gtm-init" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${config.gtmContainerId}');`}
        </Script>
      )}

      {consent.advertising && ADSENSE.enabled && ADSENSE.publisherId && (
        <Script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE.publisherId}`}
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      )}
    </>
  );
}
