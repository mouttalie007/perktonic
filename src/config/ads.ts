import { clientEnv } from "./env";

/**
 * Advertising configuration (spec §11, §16, §46, §80).
 * Publisher / slot IDs come from env only — never hard-coded. Actual AdUnit
 * markup and placement mapping are stored in the database and managed from the
 * Admin Dashboard (Phase 7). This file defines the fixed set of template slots.
 */

/**
 * The AdSense publisher identity used for site verification. It is a public
 * identifier (it sits in every page's HTML and in /ads.txt by design), not a
 * secret, so it lives here rather than in an env var: verification must work
 * on every deploy with no server-side setup.
 */
export const ADSENSE_PUBLISHER = {
  client: "ca-pub-4779364737907056",
  /** Script URL exactly as AdSense issues it for the site-verification snippet. */
  scriptSrc:
    "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4779364737907056",
} as const;

/** ads.txt line served when ADS_TXT_CONTENT isn't set in the environment. */
export const DEFAULT_ADS_TXT =
  "google.com, pub-4779364737907056, DIRECT, f08c47fec0942fa0";

export const ADSENSE = {
  enabled: clientEnv.NEXT_PUBLIC_ADSENSE_ENABLED,
  publisherId: clientEnv.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID,
  autoAds: clientEnv.NEXT_PUBLIC_ADSENSE_AUTO_ADS,
} as const;

/** Machine keys for every ad slot the templates expose. */
export const AD_PLACEMENT_KEYS = [
  "top-leaderboard",
  "under-title",
  "in-content",
  "between-slides",
  "sidebar",
  "below-article",
  "mobile-anchor",
] as const;

export type AdPlacementKey = (typeof AD_PLACEMENT_KEYS)[number];

export interface AdPlacementDef {
  key: AdPlacementKey;
  label: string;
  description: string;
  /** Default reserved height (px) to prevent CLS before the ad loads. */
  reservedHeight: { desktop: number; mobile: number };
}

export const AD_PLACEMENTS: AdPlacementDef[] = [
  {
    key: "top-leaderboard",
    label: "Top Leaderboard",
    description: "Above the header content, full width.",
    reservedHeight: { desktop: 90, mobile: 100 },
  },
  {
    key: "under-title",
    label: "Under Title",
    description:
      "Directly beneath the article H1 / above the body. Repeats on every listicle subpage.",
    reservedHeight: { desktop: 280, mobile: 250 },
  },
  {
    key: "in-content",
    label: "In-Content",
    description:
      "Injected between body sections of a standard article (auto every N paragraphs or via [AD] marker).",
    reservedHeight: { desktop: 280, mobile: 250 },
  },
  {
    key: "between-slides",
    label: "Between Slides",
    description: "Between the image and the description on a listicle subpage.",
    reservedHeight: { desktop: 280, mobile: 250 },
  },
  {
    key: "sidebar",
    label: "Sidebar",
    description: "Sticky sidebar rectangle on desktop layouts.",
    reservedHeight: { desktop: 600, mobile: 0 },
  },
  {
    key: "below-article",
    label: "Below Article",
    description: "After the article body, before related stories.",
    reservedHeight: { desktop: 280, mobile: 250 },
  },
  {
    key: "mobile-anchor",
    label: "Mobile Anchor",
    description: "Sticky anchor unit at the bottom of the viewport on mobile.",
    reservedHeight: { desktop: 0, mobile: 50 },
  },
];

/** Label shown above ad containers (spec §11 — no misleading labels). */
export const AD_LABEL = "Advertisement";
