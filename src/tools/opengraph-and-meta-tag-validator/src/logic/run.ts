import { extractTags, type PageTags } from "./extract";
import { fetchImage, fetchPage, type Fetcher, type ImageFetch } from "./fetchPage";
import { buildPreviews, type Previews } from "./previews";
import { pickImage, validate, type Issue } from "./validate";

export interface RunInput {
  url: string;
}

export interface Deps {
  fetcher: Fetcher;
}

export interface ValidationResult {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  redirects: string[];
  truncated: boolean;
  tags: PageTags;
  image: Omit<ImageFetch, "dataUrl"> | null;
  twitterImage: Omit<ImageFetch, "dataUrl"> | null;
  issues: Issue[];
  previews: Previews;
}

const strip = (i: ImageFetch | null): Omit<ImageFetch, "dataUrl"> | null => {
  if (!i) return null;
  const { dataUrl: _drop, ...rest } = i;
  void _drop;
  return rest;
};

/** Fetches the page, then its share image (and twitter:image if it differs), all through the kit's safeFetch. */
export async function run(input: RunInput, deps: Deps): Promise<ValidationResult> {
  const page = await fetchPage(input.url, deps.fetcher);
  const tags = extractTags(page.html);
  const candidate = pickImage(tags, page.finalUrl);
  const image = candidate ? await fetchImage(candidate.url, deps.fetcher) : null;
  let twitterImage: ImageFetch | null = null;
  const tw = tags.twitter["twitter:image"];
  if (tw && candidate) {
    const twUrl = (() => {
      try {
        return new URL(tw, tags.baseHref ? new URL(tags.baseHref, page.finalUrl) : page.finalUrl).toString();
      } catch {
        return null;
      }
    })();
    if (twUrl && twUrl !== candidate.url) twitterImage = await fetchImage(twUrl, deps.fetcher);
  }
  const issues = validate(tags, page, image, candidate);
  if (page.truncated) issues.push({ severity: "info", area: "seo", message: "The page is larger than 2 MB; only the first 2 MB were checked.", fix: null });
  return {
    requestedUrl: input.url,
    finalUrl: page.finalUrl,
    status: page.status,
    redirects: page.redirects,
    truncated: page.truncated,
    tags,
    image: strip(image),
    twitterImage: strip(twitterImage),
    issues,
    previews: buildPreviews(tags, page.finalUrl, image, twitterImage),
  };
}
