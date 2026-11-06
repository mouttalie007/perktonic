import { parse } from "node-html-parser";

/**
 * On-page SEO and style check of an article draft, shown live in the admin editor.
 * Pure (no DOM, no server), so it is unit-tested and the numbers below are the single source of truth.
 * The aim is a technical article that answers one problem: clear title, honest meta description, structure,
 * images that have alt text, links to our tools, and no hype language.
 */

export type CheckStatus = "ok" | "warn" | "bad";
export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface SeoCheckInput {
  title: string;
  slug: string;
  excerpt: string;
  seoTitle: string;
  metaDescription: string;
  /** The article body as HTML. */
  html: string;
  hasFeaturedImage: boolean;
  /** Host of the site, to tell internal links from external ones (e.g. "perktonic.com"). */
  siteHost?: string;
}

export const LIMITS = {
  /** What Google shows of a title, in characters. */
  titleMax: 60,
  titleMin: 25,
  /** Added by the title template when the whole title still fits (see seo.service). */
  brandSuffix: " | PerkTonic".length,
  descMin: 120,
  descMax: 160,
  slugMax: 60,
  wordsGood: 500,
  wordsMin: 250,
  paragraphWordsMax: 110,
};

/** Words that make a technical page read like clickbait or a magazine. */
const HYPE = [
  "ultimate", "amazing", "shocking", "incredible", "mind-blowing", "game-changer", "game changer", "revolutionary",
  "you won't believe", "you wont believe", "secret", "hack", "unlock", "delve", "in today's world", "in today's digital",
  "ever-evolving", "landscape", "journey", "unleash", "supercharge", "skyrocket", "best-kept",
];

const words = (text: string) => (text.match(/[\p{L}\p{N}'’-]+/gu) ?? []).length;

export function seoCheck(input: SeoCheckInput): Check[] {
  const checks: Check[] = [];
  const add = (id: string, label: string, status: CheckStatus, detail: string) => checks.push({ id, label, status, detail });

  const root = parse(input.html || "");
  const plain = root.text.replace(/\s+/g, " ").trim();
  const wordCount = words(plain);

  // 1. Title tag
  const seoTitle = (input.seoTitle || input.title).trim();
  const len = seoTitle.length;
  if (!len) add("title", "Title", "bad", "Write a title.");
  else if (len > LIMITS.titleMax) add("title", "Title length", "warn", `${len} characters: Google cuts a title after about ${LIMITS.titleMax}. Shorten it.`);
  else if (len < LIMITS.titleMin) add("title", "Title length", "warn", `${len} characters: add the problem or the tool name so the title says what the page solves.`);
  else if (len + LIMITS.brandSuffix > LIMITS.titleMax) add("title", "Title length", "ok", `${len} characters. The brand name is not added to it, so the keywords stay visible.`);
  else add("title", "Title length", "ok", `${len} characters, with room for the brand name.`);

  // 2. Meta description
  const desc = input.metaDescription.trim();
  if (!desc) add("desc", "Meta description", "bad", "Write one: it is the text shown under the title in search results.");
  else if (desc.length < LIMITS.descMin) add("desc", "Meta description", "warn", `${desc.length} characters: use ${LIMITS.descMin} to ${LIMITS.descMax}, and say what the reader gets.`);
  else if (desc.length > LIMITS.descMax) add("desc", "Meta description", "warn", `${desc.length} characters: Google cuts it after about ${LIMITS.descMax}.`);
  else add("desc", "Meta description", "ok", `${desc.length} characters.`);

  // 3. Slug
  const slug = input.slug.trim();
  if (!slug) add("slug", "Slug", "bad", "The slug is empty.");
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) add("slug", "Slug", "bad", "Use lowercase letters, digits and single hyphens only.");
  else if (slug.length > LIMITS.slugMax) add("slug", "Slug", "warn", `${slug.length} characters: keep it under ${LIMITS.slugMax}, with the main keywords.`);
  else add("slug", "Slug", "ok", `${slug.length} characters.`);

  // 4. Excerpt and featured image
  add("excerpt", "Excerpt", input.excerpt.trim().length >= 50 ? "ok" : "warn", input.excerpt.trim().length >= 50 ? "Present." : "Add a one or two sentence summary (used in cards and shares).");
  add("featured", "Featured image", input.hasFeaturedImage ? "ok" : "warn", input.hasFeaturedImage ? "Set." : "Add one: it is the image of the card and of the social preview.");

  // 5. Length
  if (wordCount >= LIMITS.wordsGood) add("words", "Length", "ok", `${wordCount} words.`);
  else if (wordCount >= LIMITS.wordsMin) add("words", "Length", "warn", `${wordCount} words: enough for a short fix, thin for a tutorial. Cover the common errors and one example.`);
  else add("words", "Length", "bad", `${wordCount} words: too thin to rank or to be approved by an ad network.`);

  // 6. Headings
  const h1 = root.querySelectorAll("h1").length;
  const h2s = root.querySelectorAll("h2").map((h) => h.text.trim().toLowerCase());
  if (h1) add("h1", "Headings", "bad", "Remove the H1 from the body: the page already shows the title as H1.");
  else if (h2s.length < 2) add("h1", "Headings", "warn", "Use at least two H2 sections (steps, errors, limits) so the page is easy to scan.");
  else if (new Set(h2s).size < h2s.length) add("h1", "Headings", "warn", "Two H2 headings are identical. Make each one specific.");
  else add("h1", "Headings", "ok", `${h2s.length} sections.`);

  // 7. Images
  const imgs = root.querySelectorAll("img");
  const noAlt = imgs.filter((i) => !(i.getAttribute("alt") ?? "").trim());
  const badAlt = imgs.filter((i) => /\.(png|jpe?g|webp|gif)$/i.test((i.getAttribute("alt") ?? "").trim()) || /^(image|screenshot|img)[\s_-]*\d*$/i.test((i.getAttribute("alt") ?? "").trim()));
  if (!imgs.length) add("img", "Images", "warn", "No image in the body. A screenshot of the tool at each key step makes a technical guide clearer.");
  else if (noAlt.length) add("img", "Images", "bad", `${noAlt.length} of ${imgs.length} image(s) have no alt text.`);
  else if (badAlt.length) add("img", "Images", "warn", `${badAlt.length} alt text(s) are a file name or just "image": describe what the screenshot shows.`);
  else add("img", "Images", "ok", `${imgs.length} image(s), all with alt text.`);

  // 8. Links
  const host = (input.siteHost ?? "").replace(/^www\./, "");
  const links = root.querySelectorAll("a").map((a) => a.getAttribute("href") ?? "").filter(Boolean);
  const isExternal = (h: string) => /^https?:\/\//i.test(h) && !(host && new URL(h).hostname.replace(/^www\./, "") === host);
  const external = links.filter(isExternal);
  const internal = links.filter((h) => !isExternal(h) && !h.startsWith("#") && !h.startsWith("mailto:"));
  const toTool = internal.filter((h) => /\/tools\//.test(h));
  if (!toTool.length) add("tool", "Link to a tool", "bad", "Link to the tool this guide is about (a /tools/... page): it is why the guide exists.");
  else add("tool", "Link to a tool", "ok", `${toTool.length} link(s) to a tool.`);
  if (internal.length < 2) add("internal", "Internal links", "warn", "Add at least two internal links (a related tool or guide).");
  else add("internal", "Internal links", "ok", `${internal.length} internal link(s).`);
  if (!external.length) add("external", "Sources", "warn", "Link at least once to official documentation when you cite a function, a standard or a behaviour.");
  else add("external", "Sources", "ok", `${external.length} external link(s).`);

  // 9. Style: technical, not magazine
  const lower = ` ${input.title} ${plain}`.toLowerCase();
  const hype = HYPE.filter((w) => lower.includes(w));
  if (hype.length) add("tone", "Tone", "warn", `Hype or magazine wording: ${hype.slice(0, 5).map((w) => `"${w}"`).join(", ")}. Say what it does, plainly.`);
  else add("tone", "Tone", "ok", "Plain and technical.");
  const longParas = root.querySelectorAll("p").filter((p) => words(p.text) > LIMITS.paragraphWordsMax).length;
  add("paras", "Paragraphs", longParas ? "warn" : "ok", longParas ? `${longParas} paragraph(s) over ${LIMITS.paragraphWordsMax} words: split them or use a list.` : "Short enough to scan.");
  if (/[—–]/.test(plain)) add("dash", "Punctuation", "warn", "The text contains long dashes (— or –). Use a colon, a comma or two sentences.");

  return checks;
}

/** One number for the header of the panel: share of checks that pass. */
export function seoScore(checks: Check[]): number {
  if (!checks.length) return 0;
  const pts = checks.reduce((n, c) => n + (c.status === "ok" ? 1 : c.status === "warn" ? 0.5 : 0), 0);
  return Math.round((pts / checks.length) * 100);
}
