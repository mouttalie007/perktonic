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

const DEFAULT_SITE: SiteSettings = {
  id: SINGLETON_ID,
  siteName: "ViralTrendly.com",
  siteUrl: "https://viraltrendly.com",
  tagline: "TREND TODAY. TALK TOMORROW.",
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
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

const DEFAULT_SEO: SeoSettings = {
  id: SINGLETON_ID,
  defaultTitle:
    "ViralTrendly — Trending Stories, Viral News & Stories Worth Sharing",
  titleTemplate: "%s — ViralTrendly",
  defaultMetaDescription:
    "Trending stories, viral news and fascinating reads worth sharing — across tech, people, lifestyle, entertainment, travel, health and more.",
  defaultRobotsIndex: true,
  googleSiteVerification: null,
  bingSiteVerification: null,
  organizationName: "ViralTrendly",
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
  getSiteSettings: cache(async (): Promise<SiteSettings> => {
    const row = await prisma.siteSettings.findUnique({
      where: { id: SINGLETON_ID },
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
