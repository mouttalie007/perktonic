// No imports: shared by the client component and the route.

export const MAX_URL_LENGTH = 2048;
/** Sitemap files fetched per check (robots.txt not included). */
export const MAX_SITEMAP_FILES = 5;
/** Our download cap per sitemap file. */
export const SITEMAP_MAX_BYTES = 2 * 1024 * 1024;
/** Largest .xml.gz we unpack. */
export const GUNZIP_MAX_BYTES = 10 * 1024 * 1024;
export const MAX_TEST_URLS = 10;
export const MAX_USER_AGENTS = 5;
/** Stop fetching more sitemaps after this long, so a slow site cannot hold the route. */
export const CHECK_BUDGET_MS = 45_000;

/** Common crawlers offered in the user-agent picker. */
export const CRAWLERS = ["Googlebot", "Googlebot-Image", "Bingbot", "GPTBot", "ClaudeBot", "CCBot", "Applebot", "DuckDuckBot", "YandexBot", "Baiduspider", "*"] as const;
