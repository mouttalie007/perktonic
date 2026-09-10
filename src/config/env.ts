import { z } from "zod";

/**
 * Client-safe environment access (`NEXT_PUBLIC_*` only).
 *
 * This module is import-safe from Client Components. Server-only variables
 * (DATABASE_URL, secrets, …) live in `env.server.ts`, which must never be
 * imported into the client bundle.
 */

const boolish = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_ADSENSE_ENABLED: boolish,
  NEXT_PUBLIC_ADSENSE_PUBLISHER_ID: z.string().optional().default(""),
  NEXT_PUBLIC_ADSENSE_AUTO_ADS: boolish,
  NEXT_PUBLIC_GA4_MEASUREMENT_ID: z.string().optional().default(""),
  NEXT_PUBLIC_GTM_CONTAINER_ID: z.string().optional().default(""),
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: z.string().optional().default(""),
});

// Each var referenced as a full literal so Next.js inlines it client-side.
const clientEnvRaw = {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_ADSENSE_ENABLED: process.env.NEXT_PUBLIC_ADSENSE_ENABLED,
  NEXT_PUBLIC_ADSENSE_PUBLISHER_ID:
    process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID,
  NEXT_PUBLIC_ADSENSE_AUTO_ADS: process.env.NEXT_PUBLIC_ADSENSE_AUTO_ADS,
  NEXT_PUBLIC_GA4_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
  NEXT_PUBLIC_GTM_CONTAINER_ID: process.env.NEXT_PUBLIC_GTM_CONTAINER_ID,
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION:
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
};

function loadClientEnv() {
  const parsed = clientSchema.safeParse(clientEnvRaw);
  if (!parsed.success) {
    // Non-fatal: fall back to schema defaults rather than break the app for a
    // missing optional public var.
    console.warn(
      "Public env fell back to defaults:",
      z.flattenError(parsed.error).fieldErrors,
    );
    return clientSchema.parse({});
  }
  return parsed.data;
}

export const clientEnv = loadClientEnv();
