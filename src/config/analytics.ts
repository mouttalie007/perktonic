import { clientEnv } from "./env";

/**
 * Analytics configuration (spec §50).
 * IDs come from env. Scripts are only loaded once the corresponding consent
 * category is granted (ConsentManager, Phase 9).
 */

export const ANALYTICS = {
  ga4MeasurementId: clientEnv.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
  gtmContainerId: clientEnv.NEXT_PUBLIC_GTM_CONTAINER_ID,
  googleSiteVerification: clientEnv.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  get ga4Enabled() {
    return this.ga4MeasurementId.length > 0;
  },
  get gtmEnabled() {
    return this.gtmContainerId.length > 0;
  },
} as const;
