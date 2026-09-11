import { serverEnv } from "@/config/env.server";

/**
 * ads.txt (spec §49). Content comes only from config (ADS_TXT_CONTENT) —
 * never a fabricated publisher line. Empty until a real network account is
 * configured; the placeholder is a comment, which parsers ignore.
 */
export async function GET() {
  const content = serverEnv.ADS_TXT_CONTENT.trim();
  const body = content
    ? `${content}\n`
    : "# ads.txt will be populated once an AdSense (or other ad network) account is configured.\n";

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
