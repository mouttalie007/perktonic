import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { SiteSettings, SeoSettings } from "@prisma/client";

const SINGLETON_ID = "singleton";

/**
 * Site + SEO settings (spec §37, §91). Singleton rows created by the seed and
 * edited from the Admin Dashboard; the frontend only reads. Reads never write —
 * if a row is somehow missing we fall back to schema defaults in memory.
 * Wrapped in React `cache()` so repeated calls within one request hit the DB once.
 */

/**
 * What the rest of the app may see. The encrypted Claude API key column is
 * omitted from every read here (it's only ever touched by
 * src/lib/ai-article/api-key.ts), so it can't leak through a settings object
 * that later gets passed to a component or serialised into a response.
 */
type PublicSiteSettings = Omit<SiteSettings, "anthropicApiKeyEnc">;

const DEFAULT_SITE: PublicSiteSettings = {
  id: SINGLETON_ID,
  siteName: "PerkTonic.com",
  siteUrl: "https://perktonic.com",
  tagline: "Find the good stuff before everyone else does.",
  logoUrl: null,
  defaultOgImageUrl: null,
  contactEmail: null,
  facebookUrl: null,
  xUrl: null,
  instagramUrl: null,
  youtubeUrl: null,
  tiktokUrl: null,
  newsletterProvider: null,
  newsletterFromName: null,
  tickerEnabled: true,
  homepageConfig: null,
  navigationConfig: null,
  demoCommentPool: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const DEFAULT_SEO: SeoSettings = {
  id: SINGLETON_ID,
  defaultTitle: "PerkTonic: Free Stuff, Hidden Web Tricks & Smart Deals",
  titleTemplate: "%s — PerkTonic",
  defaultMetaDescription:
    "Discover free samples, hidden Google features, free AI tools, rewards and money-saving tricks. Honest, tested guides updated regularly.",
  defaultRobotsIndex: true,
  googleSiteVerification: null,
  bingSiteVerification: null,
  organizationName: "PerkTonic",
  organizationLogoUrl: null,
  twitterHandle: null,
  tagPagesIndexable: false,
  searchPagesIndexable: false,
  ga4MeasurementId: null,
  gtmContainerId: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

export const siteSettingsService = {
  getSiteSettings: cache(async (): Promise<PublicSiteSettings> => {
    const row = await prisma.siteSettings.findUnique({
      where: { id: SINGLETON_ID },
      omit: { anthropicApiKeyEnc: true },
    });
    return row ?? DEFAULT_SITE;
  }),

  getSeoSettings: cache(async (): Promise<SeoSettings> => {
    const row = await prisma.seoSettings.findUnique({
      where: { id: SINGLETON_ID },
    });
    return row ?? DEFAULT_SEO;
  }),

  async getSocialLinks() {
    const s = await this.getSiteSettings();
    return {
      facebook: s.facebookUrl ?? "",
      x: s.xUrl ?? "",
      instagram: s.instagramUrl ?? "",
      youtube: s.youtubeUrl ?? "",
      tiktok: s.tiktokUrl ?? "",
    };
  },
};
