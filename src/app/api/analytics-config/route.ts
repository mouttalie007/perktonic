import { NextResponse } from "next/server";
import { siteSettingsService } from "@/services/site-settings.service";
import { ANALYTICS } from "@/config/analytics";

/**
 * Public, no-secrets config for AnalyticsScripts (client component) to
 * fetch at runtime. Admin-set values (Settings -> SEO -> Analytics) win;
 * env vars are only a fallback for a box where nobody has opened the admin
 * yet. A plain client-bundled import of these values would be frozen in
 * at build time — this route makes them editable with zero redeploy.
 *
 * `force-dynamic`: this is a tiny singleton-row lookup, cheap enough to
 * run on every request, and correctness (reflecting an admin edit
 * immediately) matters more here than shaving one DB query.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const seo = await siteSettingsService.getSeoSettings();
  const ga4MeasurementId = seo.ga4MeasurementId || ANALYTICS.ga4MeasurementId;
  const gtmContainerId = seo.gtmContainerId || ANALYTICS.gtmContainerId;

  return NextResponse.json({
    ga4MeasurementId,
    gtmContainerId,
  });
}
