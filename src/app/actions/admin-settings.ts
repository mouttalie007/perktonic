"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-admin";

function str(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) || "").trim();
  return v || null;
}

export async function updateSiteSettings(formData: FormData) {
  await requireUser("ADMIN");
  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    update: {
      siteName: str(formData, "siteName") ?? "PerkTonic.com",
      tagline: str(formData, "tagline") ?? "Find the good stuff before everyone else does.",
      logoUrl: str(formData, "logoUrl"),
      defaultOgImageUrl: str(formData, "defaultOgImageUrl"),
      contactEmail: str(formData, "contactEmail"),
      facebookUrl: str(formData, "facebookUrl"),
      xUrl: str(formData, "xUrl"),
      instagramUrl: str(formData, "instagramUrl"),
      youtubeUrl: str(formData, "youtubeUrl"),
      tiktokUrl: str(formData, "tiktokUrl"),
      tickerEnabled: formData.get("tickerEnabled") === "on",
    },
    create: { id: "singleton" },
  });
  revalidatePath("/", "layout");
  revalidatePath("/adminiyad/settings/site");
}

export async function updateSeoSettings(formData: FormData) {
  await requireUser("ADMIN");
  await prisma.seoSettings.upsert({
    where: { id: "singleton" },
    update: {
      defaultTitle:
        str(formData, "defaultTitle") ??
        "PerkTonic: Free Stuff, Hidden Web Tricks & Smart Deals",
      titleTemplate: str(formData, "titleTemplate") ?? "%s — PerkTonic",
      defaultMetaDescription: str(formData, "defaultMetaDescription") ?? "",
      defaultRobotsIndex: formData.get("defaultRobotsIndex") === "on",
      googleSiteVerification: str(formData, "googleSiteVerification"),
      bingSiteVerification: str(formData, "bingSiteVerification"),
      organizationName: str(formData, "organizationName") ?? "PerkTonic",
      organizationLogoUrl: str(formData, "organizationLogoUrl"),
      twitterHandle: str(formData, "twitterHandle"),
      tagPagesIndexable: formData.get("tagPagesIndexable") === "on",
      searchPagesIndexable: formData.get("searchPagesIndexable") === "on",
      ga4MeasurementId: str(formData, "ga4MeasurementId"),
      gtmContainerId: str(formData, "gtmContainerId"),
    },
    create: { id: "singleton" },
  });
  revalidatePath("/", "layout");
  revalidatePath("/adminiyad/settings/seo");
}
