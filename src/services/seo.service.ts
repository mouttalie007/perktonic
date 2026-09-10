import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { siteSettingsService } from "./site-settings.service";

/**
 * Central metadata + structured-data builder (spec §32–§37, §52, §77).
 * Every route composes its <head> through here so titles, canonicals and
 * social tags stay consistent and never duplicate.
 */

function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE.url.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export interface PageMetaInput {
  title: string;
  description?: string;
  path: string; // site-relative, becomes canonical
  ogImage?: string;
  type?: "website" | "article";
  robotsIndex?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
}

export const seoService = {
  absoluteUrl,

  async buildMetadata(input: PageMetaInput): Promise<Metadata> {
    const seo = await siteSettingsService.getSeoSettings();
    const canonical = absoluteUrl(input.path);
    const description = input.description ?? seo.defaultMetaDescription;
    const ogImage = absoluteUrl(
      input.ogImage ?? seo.organizationLogoUrl ?? "/og-default.png",
    );
    const index = input.robotsIndex ?? seo.defaultRobotsIndex;

    return {
      title: input.title,
      description,
      alternates: { canonical },
      robots: {
        index,
        follow: true,
        googleBot: { index, follow: true },
      },
      openGraph: {
        title: input.title,
        description,
        url: canonical,
        siteName: SITE.shortName,
        type: input.type ?? "website",
        locale: SITE.locale,
        images: [{ url: ogImage }],
        ...(input.publishedTime
          ? { publishedTime: input.publishedTime }
          : {}),
        ...(input.modifiedTime ? { modifiedTime: input.modifiedTime } : {}),
      },
      twitter: {
        card: "summary_large_image",
        title: input.title,
        description,
        images: [ogImage],
        ...(seo.twitterHandle ? { site: seo.twitterHandle } : {}),
      },
    };
  },

  /** JSON-LD: Organization + WebSite + SearchAction for the homepage (spec §36). */
  async organizationAndWebsiteJsonLd() {
    const seo = await siteSettingsService.getSeoSettings();
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": absoluteUrl("/#organization"),
          name: seo.organizationName,
          url: SITE.url,
          logo: seo.organizationLogoUrl
            ? absoluteUrl(seo.organizationLogoUrl)
            : undefined,
        },
        {
          "@type": "WebSite",
          "@id": absoluteUrl("/#website"),
          url: SITE.url,
          name: SITE.shortName,
          publisher: { "@id": absoluteUrl("/#organization") },
          potentialAction: {
            "@type": "SearchAction",
            target: `${absoluteUrl("/search")}?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        },
      ],
    };
  },

  /** JSON-LD: BreadcrumbList (spec §71). */
  breadcrumbJsonLd(crumbs: { name: string; path: string }[]) {
    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: crumbs.map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        item: absoluteUrl(c.path),
      })),
    };
  },
};
