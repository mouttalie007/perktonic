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
  tagline: "Free online tools for smarter workflows.",
  url: clientEnv.NEXT_PUBLIC_SITE_URL,
  locale: "en_US",
  description:
    "Free online tools for spreadsheets, data, documents, automation and web diagnostics, plus practical guides to get more from them.",
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
  | "spreadsheet-studio"
  | "data-converters"
  | "document-intelligence"
  | "workflow-automation"
  | "web-diagnostics";

export interface CategoryDef {
  slug: CategoryKey;
  name: string;
  /** ToolIcon key (src/components/site/ToolIcon.tsx). */
  iconKey: string;
  shortDescription: string;
  description: string;
  /** Text-safe accent colour for the category. */
  accentColor: string;
}

// Replaced 2026-10-29 (pivot to cloud tools; AdSense "low value content" feedback).
// Names/descriptions mirror the Category rows seeded by prisma/seed-tool-categories.ts;
// the copy shown on the homepage cards is the short one below.
export const CATEGORIES: CategoryDef[] = [
  {
    slug: "spreadsheet-studio",
    name: "Spreadsheet & Formula Studio",
    iconKey: "sheet",
    shortDescription: "Generate, debug and explain Excel & Google Sheets formulas.",
    description:
      "Translate plain English into production-ready Excel and Google Sheets formulas, explain nested logic step by step, and automate complex lookups.",
    accentColor: "#047857",
  },
  {
    slug: "data-converters",
    name: "Data Cleaning & File Converters",
    iconKey: "database",
    shortDescription: "Clean, transform and convert your data files with ease.",
    description:
      "Clean messy CSV exports, remove duplicates, normalize dates and convert between JSON, Excel, Markdown and LaTeX.",
    accentColor: "#6D28D9",
  },
  {
    slug: "document-intelligence",
    name: "Document & Text Intelligence",
    iconKey: "pdf",
    shortDescription: "Extract data, summarize text and create professional docs.",
    description:
      "Pull tables out of PDFs, turn long agreements into checklists and generate standardized business documents.",
    accentColor: "#B91C1C",
  },
  {
    slug: "workflow-automation",
    name: "Workflow & Automation Utilities",
    iconKey: "gear",
    shortDescription: "Regex, cron, webhooks, diagrams and more.",
    description:
      "Build and test regular expressions, schedule cron jobs, inspect webhook payloads and turn text into diagrams.",
    accentColor: "#B45309",
  },
  {
    slug: "web-diagnostics",
    name: "Web & Network Diagnostics",
    iconKey: "globe",
    shortDescription: "Analyze websites, headers, redirects and server performance.",
    description:
      "Trace redirect chains, audit HTTP headers, measure server response time and validate page metadata.",
    accentColor: "#1D4ED8",
  },
];

export interface NavLink {
  label: string;
  href: string;
}

/** Primary navigation (desktop + mobile). "Categories" is a dropdown built from CATEGORIES. */
export const NAV_LINKS: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Tools", href: "/tools" },
  { label: "Blog", href: "/blog" },
  { label: "About", href: "/about" },
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
