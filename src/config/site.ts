import { clientEnv } from "./env";

/**
 * Static site configuration and canonical taxonomy (spec §37, §90, §91, §94).
 * These are the defaults / fallbacks. Once the Admin Dashboard (Phase 7) is in
 * place, navigation, categories and social links are served from the database
 * (SiteSettings.navigationConfig, Category rows) and override these values.
 */

export const SITE = {
  name: "PerkTonic.com",
  shortName: "PerkTonic",
  tagline: "Find the good stuff before everyone else does.",
  url: clientEnv.NEXT_PUBLIC_SITE_URL,
  locale: "en_US",
  description:
    "Legit freebies, free AI tools, hidden web tricks and smart deals. Checked, honest and updated.",
} as const;

/** Social profiles. Empty until set from the Admin Dashboard / env. */
export const SOCIAL_LINKS = {
  facebook: "",
  x: "",
  instagram: "",
  youtube: "",
  tiktok: "",
} as const;

export type SocialPlatform = keyof typeof SOCIAL_LINKS;

/** Order + accessible labels for rendering the social icon row. */
export const SOCIAL_PLATFORMS: { key: SocialPlatform; label: string }[] = [
  { key: "facebook", label: "Facebook" },
  { key: "x", label: "X" },
  { key: "instagram", label: "Instagram" },
  { key: "youtube", label: "YouTube" },
  { key: "tiktok", label: "TikTok" },
];

export type CategoryKey =
  | "free-samples"
  | "ai-tools"
  | "rewards-perks"
  | "money-saving";

export interface CategoryDef {
  slug: CategoryKey;
  name: string;
  iconKey: string;
  shortDescription: string;
  description: string;
  /** Text-safe accent (Tailwind 700/800-depth — see prisma/seed.ts's note
   *  on why that tier, not the brighter 500/600, is what clears WCAG AA
   *  against white). Kept in sync with the DB seed's category colors by
   *  hand — this config predates the DB and several other fields
   *  (name/description) are already duplicated the same way. */
  accentColor: string;
}

// Replaced 2026-10-08 (pivot to PerkTonic.com — a verified free-samples/
// AI-tools/rewards/savings niche, per the AdSense-approval-focused site
// structure doc). The old 14-category "viral magazine" taxonomy is gone.
export const CATEGORIES: CategoryDef[] = [
  {
    slug: "free-samples",
    name: "Free Samples & Products",
    iconKey: "gift",
    shortDescription: "Real freebies, verified",
    description:
      "Legitimate free samples, product-testing programs and freebie offers — checked for scams before we share them.",
    accentColor: "#047857",
  },
  {
    slug: "ai-tools",
    name: "Internet Secrets & AI Tools",
    iconKey: "cpu",
    shortDescription: "Hidden tools & AI tricks",
    description:
      "Free AI tools, hidden Google features and useful websites most people have never heard of.",
    accentColor: "#1D4ED8",
  },
  {
    slug: "rewards-perks",
    name: "Rewards, Trials & Digital Perks",
    iconKey: "trophy",
    shortDescription: "Gift cards, trials & perks",
    description:
      "Gift card programs, free trials, cashback apps and digital perks worth knowing about — including how to cancel before you're charged.",
    accentColor: "#6D28D9",
  },
  {
    slug: "money-saving",
    name: "Money-Saving Guides",
    iconKey: "wallet",
    shortDescription: "Smarter spending",
    description:
      "Coupon tools, price-history tricks and the discounts most people miss — practical ways to spend less.",
    accentColor: "#92400E",
  },
];

export interface NavItem {
  label: string;
  href: string;
  /** icons.tsx key ("home") or a CategoryIcon key — null falls back to no icon. */
  iconKey: string | null;
  /** Text-safe accent for the icon/underline on hover+active — null = brand yellow. */
  accentColor: string | null;
}

function navItemFor(slug: CategoryKey): NavItem {
  const c = CATEGORIES.find((cat) => cat.slug === slug)!;
  return { label: c.name, href: `/category/${c.slug}`, iconKey: c.iconKey, accentColor: c.accentColor };
}

/**
 * Primary desktop navigation (spec §7), with icon+accent for the redesigned
 * nav (2026-09-12). Only 4 categories now (PerkTonic pivot, 2026-10-08) —
 * all of them fit directly in the primary bar, so there's nothing left for
 * a "MORE" dropdown (HeaderBar hides that button entirely when NAV_MORE is
 * empty).
 */
export const NAV_PRIMARY: NavItem[] = [
  { label: "Home", href: "/", iconKey: "home", accentColor: null },
  navItemFor("free-samples"),
  navItemFor("ai-tools"),
  navItemFor("rewards-perks"),
  navItemFor("money-saving"),
];

/** "MORE" dropdown (spec §7) — empty since the 2026-10-08 pivot; kept as a
 *  typed array (not deleted) so HeaderBar's empty-state guard has something
 *  to check against, and so a future 5th+ category has somewhere to go. */
export const NAV_MORE: NavItem[] = [];

/** Categories shown in the homepage "quick navigation" strip (spec §13). */
export const QUICK_NAV_CATEGORIES: CategoryKey[] = [
  "free-samples",
  "ai-tools",
  "rewards-perks",
  "money-saving",
];

/**
 * Legal / trust pages (spec §20). The route always exists; content is managed
 * from the Admin Dashboard via the Page model.
 */
export const LEGAL_PAGES: {
  slug: string;
  title: string;
  footerColumn: "quick-links" | "resources";
}[] = [
  { slug: "about", title: "About Us", footerColumn: "quick-links" },
  { slug: "contact", title: "Contact", footerColumn: "quick-links" },
  { slug: "privacy-policy", title: "Privacy Policy", footerColumn: "quick-links" },
  {
    slug: "terms-of-service",
    title: "Terms of Service",
    footerColumn: "quick-links",
  },
  { slug: "cookie-policy", title: "Cookie Policy", footerColumn: "quick-links" },
  { slug: "sitemap", title: "Sitemap", footerColumn: "quick-links" },
  { slug: "write-for-us", title: "Write for Us", footerColumn: "resources" },
  { slug: "advertise", title: "Advertise", footerColumn: "resources" },
  {
    slug: "editorial-policy",
    title: "Editorial Policy",
    footerColumn: "resources",
  },
  { slug: "disclaimer", title: "Disclaimer", footerColumn: "resources" },
  { slug: "accessibility", title: "Accessibility", footerColumn: "resources" },
  { slug: "affiliate-disclosure", title: "Affiliate Disclosure", footerColumn: "resources" },
  // Added 2026-10-08 — required page per the AdSense trust-pack checklist
  // (perktonic-seo.md §4).
  { slug: "dmca", title: "DMCA & Copyright", footerColumn: "resources" },
];

/** Fallback byline when no individual author is assigned (spec §73). */
export const DEFAULT_AUTHOR_NAME = "PerkTonic Editorial Team";
