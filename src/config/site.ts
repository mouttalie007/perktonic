import { clientEnv } from "./env";

/**
 * Static site configuration and canonical taxonomy (spec §37, §90, §91, §94).
 * These are the defaults / fallbacks. Once the Admin Dashboard (Phase 7) is in
 * place, navigation, categories and social links are served from the database
 * (SiteSettings.navigationConfig, Category rows) and override these values.
 */

export const SITE = {
  name: "ViralTrendly.com",
  shortName: "ViralTrendly",
  tagline: "TREND TODAY. TALK TOMORROW.",
  url: clientEnv.NEXT_PUBLIC_SITE_URL,
  locale: "en_US",
  description:
    "Trending stories, viral news and fascinating reads worth sharing — across tech, people, lifestyle, entertainment, travel, health and more.",
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
  | "viral"
  | "people"
  | "tech"
  | "lifestyle"
  | "entertainment"
  | "travel"
  | "health"
  | "science"
  | "sports"
  | "amazing"
  | "food"
  | "money"
  | "culture"
  | "world";

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

export const CATEGORIES: CategoryDef[] = [
  {
    slug: "viral",
    name: "Viral",
    iconKey: "flame",
    shortDescription: "Hot stories",
    description:
      "The stories everyone is talking about right now — the internet's biggest moments as they happen.",
    accentColor: "#B91C1C",
  },
  {
    slug: "people",
    name: "People",
    iconKey: "users",
    shortDescription: "Celebrities & influencers",
    description:
      "Profiles, moments and talking points from the people shaping culture and conversation.",
    accentColor: "#6D28D9",
  },
  {
    slug: "tech",
    name: "Tech",
    iconKey: "cpu",
    shortDescription: "Innovation & AI",
    description:
      "How technology and artificial intelligence are reshaping the way we live and work.",
    accentColor: "#1D4ED8",
  },
  {
    slug: "lifestyle",
    name: "Lifestyle",
    iconKey: "coffee",
    shortDescription: "Live better",
    description:
      "Ideas, habits and small changes for a better everyday life.",
    accentColor: "#BE185D",
  },
  {
    slug: "entertainment",
    name: "Entertainment",
    iconKey: "film",
    shortDescription: "Movies, music & more",
    description:
      "The latest from film, television, music and streaming — plus the moments going viral.",
    accentColor: "#7E22CE",
  },
  {
    slug: "travel",
    name: "Travel",
    iconKey: "plane",
    shortDescription: "Discover the world",
    description:
      "Destinations, guides and the places worth seeing before they change.",
    accentColor: "#0F766E",
  },
  {
    slug: "health",
    name: "Health",
    iconKey: "heart",
    shortDescription: "Tips for a healthier you",
    description:
      "Practical, evidence-minded takes on nutrition, fitness, sleep and wellbeing.",
    accentColor: "#15803D",
  },
  {
    slug: "science",
    name: "Science",
    iconKey: "atom",
    shortDescription: "Discoveries & space",
    description:
      "Discoveries, research and the questions that change how we see the universe.",
    accentColor: "#0E7490",
  },
  {
    slug: "sports",
    name: "Sports",
    iconKey: "trophy",
    shortDescription: "The moments that matter",
    description:
      "Highlights, storylines and the viral moments from the world of sport.",
    accentColor: "#C2410C",
  },
  {
    slug: "amazing",
    name: "Amazing",
    iconKey: "sparkles",
    shortDescription: "Incredible facts",
    description:
      "Extraordinary facts, feats and stories that sound too good to be true.",
    accentColor: "#92400E",
  },
  {
    slug: "food",
    name: "Food",
    iconKey: "utensils",
    shortDescription: "Eat well",
    description: "Recipes, trends and the food stories worth a second look.",
    accentColor: "#BE123C",
  },
  {
    slug: "money",
    name: "Money",
    iconKey: "wallet",
    shortDescription: "Smarter with money",
    description:
      "Everyday money, side hustles and the economy explained simply.",
    accentColor: "#047857",
  },
  {
    slug: "culture",
    name: "Culture",
    iconKey: "palette",
    shortDescription: "Art & ideas",
    description:
      "Art, books, internet culture and the ideas moving the conversation.",
    accentColor: "#A21CAF",
  },
  {
    slug: "world",
    name: "World",
    iconKey: "globe",
    shortDescription: "Around the globe",
    description:
      "Notable stories and human moments from around the world.",
    accentColor: "#4338CA",
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

/** Primary desktop navigation (spec §7), with icon+accent for the redesigned nav (2026-09-12). */
export const NAV_PRIMARY: NavItem[] = [
  { label: "Home", href: "/", iconKey: "home", accentColor: null },
  navItemFor("viral"),
  navItemFor("people"),
  navItemFor("tech"),
  navItemFor("lifestyle"),
  navItemFor("entertainment"),
  navItemFor("travel"),
  navItemFor("health"),
];

/** "MORE" dropdown (spec §7). */
export const NAV_MORE: NavItem[] = [
  navItemFor("science"),
  navItemFor("sports"),
  navItemFor("amazing"),
  navItemFor("food"),
  navItemFor("money"),
  navItemFor("culture"),
  navItemFor("world"),
];

/** Categories shown in the homepage "quick navigation" strip (spec §13). */
export const QUICK_NAV_CATEGORIES: CategoryKey[] = [
  "viral",
  "people",
  "tech",
  "lifestyle",
  "entertainment",
  "travel",
  "health",
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
];

/** Fallback byline when no individual author is assigned (spec §73). */
export const DEFAULT_AUTHOR_NAME = "ViralTrendly Editorial Team";
