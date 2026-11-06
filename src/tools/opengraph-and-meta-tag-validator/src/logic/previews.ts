import { firstOg, type PageTags } from "./extract";
import type { ImageFetch } from "./fetchPage";

export interface PreviewImage {
  dataUrl: string | null;
  width: number | null;
  height: number | null;
}

export interface Preview {
  title: string;
  description: string | null;
  domain: string;
  image: PreviewImage | null;
  /** Large image across the card, or a small thumbnail beside the text. */
  layout: "large" | "small" | "none";
}

export interface Previews {
  facebook: Preview;
  x: Preview & { card: string };
  linkedin: Preview;
  whatsapp: Preview;
}

function toPreviewImage(img: ImageFetch | null): PreviewImage | null {
  if (!img || img.error || img.type === "unknown" || img.type === "svg") return null;
  return { dataUrl: img.dataUrl, width: img.width, height: img.height };
}

function isWide(img: PreviewImage | null, minWidth: number): boolean {
  return !!img?.width && !!img.height && img.width >= minWidth && img.width / img.height >= 1.3;
}

/**
 * Data for the approximate preview cards. The rules follow each platform's
 * documented fallbacks (twitter:* → og:* → <title>/description) and image
 * size thresholds for large versus thumbnail layouts.
 */
export function buildPreviews(tags: PageTags, pageUrl: string, primary: ImageFetch | null, twitterImage: ImageFetch | null): Previews {
  const domain = new URL(pageUrl).hostname.replace(/^www\./, "");
  const title = firstOg(tags, "og:title") ?? tags.titles[0] ?? domain;
  const description = firstOg(tags, "og:description") ?? tags.description;
  const img = toPreviewImage(primary);
  const card = tags.twitter["twitter:card"] ?? "summary";
  const xImg = toPreviewImage(twitterImage ?? primary);
  const layout = (i: PreviewImage | null, wide: boolean): Preview["layout"] => (!i ? "none" : wide ? "large" : "small");
  return {
    facebook: { title, description, domain, image: img, layout: layout(img, isWide(img, 600)) },
    x: {
      card,
      title: tags.twitter["twitter:title"] ?? title,
      description: tags.twitter["twitter:description"] ?? description,
      domain,
      image: xImg,
      layout: layout(xImg, card === "summary_large_image" && isWide(xImg, 300)),
    },
    linkedin: { title, description: null, domain, image: img, layout: layout(img, isWide(img, 400)) },
    whatsapp: { title, description, domain, image: img, layout: layout(img, isWide(img, 600)) },
  };
}
