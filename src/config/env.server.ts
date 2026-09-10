import "server-only";
import { z } from "zod";

/**
 * Server-only environment access. Importing this from a Client Component is a
 * build error (via `server-only`). Client code uses `env.ts` instead.
 */

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  ADS_TXT_CONTENT: z.string().optional().default(""),
  MEDIA_PROVIDER: z.enum(["local", "r2", "cloudinary"]).default("local"),
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
