import { prisma } from "@/lib/prisma";
import type { SiteSettings, SeoSettings } from "@prisma/client";

const SINGLETON_ID = "singleton";

/**
 * Site + SEO settings (spec §37, §91). Singleton rows; the Admin Dashboard
 * edits them, the frontend only reads. Rows are created by the seed and are
 * self-healing here if missing.
 */
export const siteSettingsService = {
  async getSiteSettings(): Promise<SiteSettings> {
    return prisma.siteSettings.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID },
    });
  },

  async getSeoSettings(): Promise<SeoSettings> {
    return prisma.seoSettings.upsert({
      where: { id: SINGLETON_ID },
      update: {},
      create: { id: SINGLETON_ID },
    });
  },

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
