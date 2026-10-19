import { DEFAULT_ADS_TXT } from "@/config/ads";
import { serverEnv } from "@/config/env.server";

/**
 * ads.txt (spec §49). ADS_TXT_CONTENT in the environment wins when set (extra
 * ad networks); otherwise the site's own AdSense line is served, so the file
 * is never empty and never contains a made-up publisher line.
 */
export async function GET() {
  const content = serverEnv.ADS_TXT_CONTENT.trim();
  const body = `${content || DEFAULT_ADS_TXT}\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Ad crawlers re-fetch it often; an hour keeps edits visible without hammering the app.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
