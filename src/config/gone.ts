/**
 * Pages of the previous site (free samples, rewards, deals) that were removed on purpose. They answer
 * "410 Gone", which tells search engines to drop them faster than a plain 404.
 */
export const GONE_ARTICLES: ReadonlySet<string> = new Set([
  "how-to-get-free-products-to-review", "how-to-cancel-a-free-trial", "how-to-stack-coupons-and-cashback",
  "is-this-website-legit", "results-about-you-google", "wayback-machine", "fake-free-offers", "free-samples-by-mail",
  "how-to-become-a-product-tester", "why-do-companies-give-free-samples", "birthday-freebies", "hidden-google-features",
  "free-ai-tools", "useful-websites", "google-search-operators", "free-ai-tools-to-replace-paid-apps", "gemini-in-chrome",
  "best-cashback-apps", "notebooklm", "best-free-trials", "how-to-get-free-gift-cards", "google-ai-pro-free-for-students",
  "how-to-find-hidden-discounts-online", "how-to-find-hidden-subscriptions", "free-perks-you-already-have",
  "websites-that-save-you-money", "best-coupon-browser-extensions", "price-history-checker", "buy-nothing-group",
  "price-adjustment-policy", "student-discounts", "free-dog-food-samples", "how-to-stop-impulse-buying-online",
  "keepa-vs-camelcamelcamel", "free-seeds", "free-beauty-samples", "free-baby-samples", "circle-to-search",
]);

export const GONE_CATEGORIES: ReadonlySet<string> = new Set(["free-samples", "rewards-perks", "money-saving", "ai-tools"]);
export const GONE_TAGS: ReadonlySet<string> = new Set(["ai", "tiktok", "viral-videos", "travel-tips", "space", "wellness"]);
export const GONE_AUTHORS: ReadonlySet<string> = new Set(["alex-carter", "mia-reynolds", "daniel-brooks"]);

/** True when the path belongs to the removed site. */
export function isGonePath(pathname: string): boolean {
  const m = /^\/(story|blog|category|tag|author)\/([a-z0-9-]+)(?:\/.*)?$/.exec(pathname);
  if (!m) return false;
  const [, kind, slug] = m;
  if (kind === "story" || kind === "blog") return GONE_ARTICLES.has(slug);
  if (kind === "category") return GONE_CATEGORIES.has(slug);
  if (kind === "tag") return GONE_TAGS.has(slug);
  return GONE_AUTHORS.has(slug);
}
