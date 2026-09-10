import { z } from "zod";

/**
 * Centralised, validated environment access (spec §91).
 * Nothing else in the app should read `process.env` directly.
 *
 * - `serverEnv` is only safe to import from server code.
 * - `clientEnv` holds `NEXT_PUBLIC_*` values, referenced as full literals so
 *   Next.js can inline them into the client bundle.
 */

const boolish = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  ADS_TXT_CONTENT: z.string().optional().default(""),
  MEDIA_PROVIDER: z
    .enum(["local", "r2", "cloudinary"])
    .default("local"),
  MEDIA_PUBLIC_BASE_URL: z.string().default("/uploads"),
  NEWSLETTER_PROVIDER: z.string().optional().default(""),
  NEWSLETTER_API_KEY: z.string().optional().default(""),
  NEWSLETTER_LIST_ID: z.string().optional().default(""),
  AUTH_SECRET: z.string().optional().default(""),
});

function loadServerEnv() {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(
      "❌ Invalid server environment variables:",
      z.flattenError(parsed.error).fieldErrors,
    );
    throw new Error("Invalid server environment variables");
  }
  return parsed.data;
}

export const serverEnv = loadServerEnv();

// ---------------------------------------------------------------------------
// Client (NEXT_PUBLIC_*)
// ---------------------------------------------------------------------------

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .url()
    .default("http://localhost:3000"),
  NEXT_PUBLIC_ADSENSE_ENABLED: boolish,
  NEXT_PUBLIC_ADSENSE_PUBLISHER_ID: z.string().optional().default(""),
  NEXT_PUBLIC_ADSENSE_AUTO_ADS: boolish,
  NEXT_PUBLIC_GA4_MEASUREMENT_ID: z.string().optional().default(""),
  NEXT_PUBLIC_GTM_CONTAINER_ID: z.string().optional().default(""),
  NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: z.string().optional().default(""),
});

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
    console.error(
      "❌ Invalid public environment variables:",
      z.flattenError(parsed.error).fieldErrors,
    );
    throw new Error("Invalid public environment variables");
  }
  return parsed.data;
}

export const clientEnv = loadClientEnv();
