import { firstOg, type PageTags } from "./extract";
import type { ImageFetch } from "./fetchPage";

export type Severity = "error" | "warning" | "info" | "good";

export interface Issue {
  severity: Severity;
  area: "seo" | "opengraph" | "twitter" | "image";
  message: string;
  /** Tag to add or change, ready to paste. */
  fix: string | null;
}

export const LIMITS = {
  titleMin: 10,
  titleMax: 60,
  descriptionMin: 50,
  descriptionMax: 160,
  imageMin: 200,
  imageRecommendedWidth: 1200,
  imageRecommendedHeight: 630,
  largeCardMin: { width: 300, height: 157 },
  ratio: 1.91,
  ratioTolerance: 0.1,
  maxImageBytes: 5 * 1024 * 1024,
};

const TWITTER_CARDS = ["summary", "summary_large_image", "app", "player"];
const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2, good: 3 };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function resolve(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

/** Compares URLs the way crawlers effectively do: scheme, host and path, ignoring a trailing slash and the fragment. */
export function sameUrl(a: string, b: string): boolean {
  try {
    const x = new URL(a);
    const y = new URL(b);
    const path = (u: URL) => u.pathname.replace(/\/+$/, "") || "/";
    return x.protocol === y.protocol && x.host.toLowerCase() === y.host.toLowerCase() && path(x) === path(y) && x.search === y.search;
  } catch {
    return false;
  }
}

export interface ImageCandidate {
  /** The tag value as written. */
  raw: string;
  url: string;
  source: "og:image" | "twitter:image";
}

/** og:image (or twitter:image when there is no og:image), resolved against <base href> or the final page URL. */
export function pickImage(tags: PageTags, pageUrl: string): ImageCandidate | null {
  const base = tags.baseHref ? resolve(tags.baseHref, pageUrl) ?? pageUrl : pageUrl;
  const og = firstOg(tags, "og:image") ?? firstOg(tags, "og:image:url") ?? firstOg(tags, "og:image:secure_url");
  if (og) {
    const url = resolve(og, base);
    return url ? { raw: og, url, source: "og:image" } : null;
  }
  const tw = tags.twitter["twitter:image"] ?? tags.twitter["twitter:image:src"];
  if (tw) {
    const url = resolve(tw, base);
    return url ? { raw: tw, url, source: "twitter:image" } : null;
  }
  return null;
}

export function validate(tags: PageTags, page: { finalUrl: string; xRobotsTag: string | null }, image: ImageFetch | null, candidate: ImageCandidate | null): Issue[] {
  const out: Issue[] = [];
  const add = (severity: Severity, area: Issue["area"], message: string, fix: string | null = null) => out.push({ severity, area, message, fix });
  const title = tags.titles[0] ?? null;
  const ogTitle = firstOg(tags, "og:title");
  const ogDesc = firstOg(tags, "og:description");
  const ogUrl = firstOg(tags, "og:url");

  // Search basics
  if (!title) add("error", "seo", "The page has no <title>. Search results and many previews fall back to the URL.", "<title>Clear page title, 30–60 characters</title>");
  else {
    if (title.length > LIMITS.titleMax) add("warning", "seo", `The title is ${title.length} characters; Google usually shows about ${LIMITS.titleMax}, so the end gets cut off.`);
    else if (title.length < LIMITS.titleMin) add("warning", "seo", `The title is only ${title.length} characters. Describe the page in 30–60 characters.`);
    else add("good", "seo", `Title length is fine (${title.length} characters).`);
  }
  if (tags.titles.length > 1) add("warning", "seo", `There are ${tags.titles.length} <title> tags; browsers and search engines use only the first.`);
  if (!tags.description) add("warning", "seo", "No meta description. Search engines then pick text from the page themselves.", '<meta name="description" content="One or two sentences, 70–160 characters.">');
  else if (tags.description.length > LIMITS.descriptionMax) add("warning", "seo", `The meta description is ${tags.description.length} characters; around ${LIMITS.descriptionMax} are shown.`);
  else if (tags.description.length < LIMITS.descriptionMin) add("info", "seo", `The meta description is short (${tags.description.length} characters).`);

  // Canonical
  if (tags.canonicals.length === 0) add("warning", "seo", "No canonical link. Add one so search engines know the preferred URL.", `<link rel="canonical" href="${esc(page.finalUrl)}">`);
  else {
    if (tags.canonicals.length > 1) add("error", "seo", `There are ${tags.canonicals.length} canonical links; search engines may ignore all of them.`);
    const canonical = resolve(tags.canonicals[0], page.finalUrl);
    if (canonical && !/^https?:/i.test(tags.canonicals[0])) add("info", "seo", `The canonical URL is relative (${tags.canonicals[0]}); an absolute URL is safer.`, `<link rel="canonical" href="${esc(canonical)}">`);
    if (canonical && !sameUrl(canonical, page.finalUrl)) {
      add("warning", "seo", `The canonical URL (${canonical}) is not the URL that was loaded (${page.finalUrl}). Search engines will probably index the canonical instead; fine for duplicates, a mistake otherwise.`);
    }
  }

  // Robots
  const robots = [tags.robots, tags.googlebot, page.xRobotsTag].filter(Boolean).join(", ").toLowerCase();
  if (/\b(noindex|none)\b/.test(robots)) {
    const where = page.xRobotsTag && /noindex|none/i.test(page.xRobotsTag) ? "the X-Robots-Tag header" : "a robots meta tag";
    add("error", "seo", `The page is set to noindex by ${where}, so it will not appear in search results.`);
  } else if (/\bnofollow\b/.test(robots)) {
    add("warning", "seo", "The page is set to nofollow: search engines will not follow its links.");
  }
  if (!tags.lang) add("info", "seo", "The <html> element has no lang attribute.", '<html lang="en">');

  // OpenGraph
  if (!ogTitle) add("error", "opengraph", "og:title is missing. Facebook and LinkedIn fall back to the <title>, WhatsApp may show nothing.", `<meta property="og:title" content="${esc(title ?? "Page title")}">`);
  if (!ogDesc) add("warning", "opengraph", "og:description is missing.", `<meta property="og:description" content="${esc(tags.description ?? "One sentence about the page.")}">`);
  if (!firstOg(tags, "og:image")) add("error", "opengraph", "og:image is missing, so shared links show no picture (or a random one).", '<meta property="og:image" content="https://example.com/share-1200x630.jpg">');
  if (!ogUrl) add("warning", "opengraph", "og:url is missing. Likes and shares may be counted against different URLs.", `<meta property="og:url" content="${esc(tags.canonicals[0] ? resolve(tags.canonicals[0], page.finalUrl) ?? page.finalUrl : page.finalUrl)}">`);
  else {
    const canonical = tags.canonicals[0] ? resolve(tags.canonicals[0], page.finalUrl) : null;
    if (canonical && !sameUrl(ogUrl, canonical)) add("warning", "opengraph", `og:url (${ogUrl}) and the canonical URL (${canonical}) differ. Use the same URL in both.`);
  }
  if (!firstOg(tags, "og:type")) add("info", "opengraph", "og:type is missing; Facebook assumes website.", '<meta property="og:type" content="website">');
  if (firstOg(tags, "og:image") && !firstOg(tags, "og:image:alt")) add("info", "opengraph", "og:image:alt is missing; screen reader users get no description of the image.", '<meta property="og:image:alt" content="What the image shows">');
  if (ogTitle && ogTitle.length > 95) add("info", "opengraph", `og:title is ${ogTitle.length} characters; Facebook cuts titles at about 2 lines.`);

  // X / Twitter
  const card = tags.twitter["twitter:card"] ?? null;
  if (!card) add("warning", "twitter", "twitter:card is missing. X then shows a small summary card at best.", '<meta name="twitter:card" content="summary_large_image">');
  else if (!TWITTER_CARDS.includes(card)) add("error", "twitter", `twitter:card "${card}" is not a valid type. Use summary, summary_large_image, app or player.`, '<meta name="twitter:card" content="summary_large_image">');
  else if (card === "player" && !tags.twitter["twitter:player"]) add("error", "twitter", "twitter:card is player but twitter:player (the iframe URL) is missing.");
  else if (card === "app" && !Object.keys(tags.twitter).some((k) => k.startsWith("twitter:app:id"))) add("error", "twitter", "twitter:card is app but no twitter:app:id:* tag is set.");
  if (tags.twitter["twitter:image"] && firstOg(tags, "og:image") && tags.twitter["twitter:image"] !== firstOg(tags, "og:image")) {
    add("info", "twitter", "twitter:image differs from og:image, so X shows a different picture than Facebook and LinkedIn.");
  }

  // Image
  if (candidate && image) {
    if (!/^https?:/i.test(candidate.raw)) add("warning", "image", `${candidate.source} is a relative URL (${candidate.raw}). Facebook and LinkedIn need an absolute URL.`, `<meta property="og:image" content="${esc(candidate.url)}">`);
    if (candidate.url.startsWith("http:")) add("warning", "image", "The image is served over plain HTTP; some platforms will not load it.");
    if (image.error) add("error", "image", `The image could not be loaded: ${image.error}`);
    else if (image.type === "svg") add("error", "image", "The image is an SVG. Facebook, X and LinkedIn do not support SVG previews; use JPEG or PNG.");
    else if (image.type === "unknown") add("error", "image", `The image URL does not return a recognised image (${image.contentType ?? "no Content-Type"}).`);
    else {
      if (image.type === "avif") add("warning", "image", "AVIF is not supported by every platform's preview yet; JPEG or PNG is safest.");
      const { width, height } = image;
      if (width && height) {
        const ratio = width / height;
        if (width < LIMITS.imageMin || height < LIMITS.imageMin) add("error", "image", `The image is ${width}×${height}; Facebook requires at least ${LIMITS.imageMin}×${LIMITS.imageMin}, so it may not be shown.`);
        else if (card === "summary_large_image" && (width < LIMITS.largeCardMin.width || height < LIMITS.largeCardMin.height)) add("warning", "image", `The image is ${width}×${height}; X large cards need at least 300×157.`);
        if (Math.abs(ratio - LIMITS.ratio) / LIMITS.ratio > LIMITS.ratioTolerance) {
          add("warning", "image", `The image ratio is ${ratio.toFixed(2)}:1, not 1.91:1, so large previews crop it${ratio < 1.2 ? " (square images often appear as a small thumbnail instead)" : ""}. Use ${LIMITS.imageRecommendedWidth}×${LIMITS.imageRecommendedHeight}.`);
        } else if (width >= LIMITS.imageRecommendedWidth) add("good", "image", `The image is ${width}×${height} (ratio ${ratio.toFixed(2)}:1), right for large previews.`);
        else if (width < 600) add("warning", "image", `The image is only ${width} px wide; below 600 px Facebook shows it as a small thumbnail.`);
        const declaredW = Number(firstOg(tags, "og:image:width"));
        const declaredH = Number(firstOg(tags, "og:image:height"));
        if (declaredW && declaredH && (declaredW !== width || declaredH !== height)) add("warning", "image", `og:image:width/height say ${declaredW}×${declaredH}, but the image is ${width}×${height}.`, `<meta property="og:image:width" content="${width}">\n<meta property="og:image:height" content="${height}">`);
      } else add("info", "image", "The image size could not be read from the file.");
      if (image.size !== null && image.size > LIMITS.maxImageBytes) add("error", "image", `The image is ${(image.size / 1048576).toFixed(1)} MB. X rejects images over 5 MB and large files slow down every share; compress it below 1 MB.`);
      else if (image.sizeAtLeast) add("info", "image", "The image is larger than 2 MB (the server did not say exactly how large). Aim for under 1 MB.");
      else if (image.size !== null && image.size > 1024 * 1024) add("info", "image", `The image is ${(image.size / 1048576).toFixed(1)} MB; under 1 MB loads faster in chat apps.`);
    }
  }
  return out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
