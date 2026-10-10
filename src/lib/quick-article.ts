/**
 * Quick Article (2026-09-28) — a manual-but-fast workflow: copy a
 * pre-written prompt, paste it into ChatGPT, paste the reply back here.
 * No API costs (reuses the editor's existing ChatGPT subscription, which
 * already includes live web search + image generation), no bot to run or
 * maintain — see the "Quick Article" discussion in project memory for why
 * this won out over a fully automated pipeline.
 */

/**
 * Matches an in-body image placeholder: `[IMAGE: <prompt for an AI image
 * generator>]`. There can be any number of these in one article — ChatGPT
 * places one wherever the piece genuinely needs an image.
 *
 * `markersToPlaceholderNodes` (2026-10-09, replacing an earlier text-
 * highlight-only version — selecting exact highlighted text to paste over
 * turned out to be too fiddly in practice) turns each one into a real
 * `imagePrompt` node (src/components/admin/image-prompt-node.tsx) before
 * the editor ever parses the HTML: a dedicated click-then-Ctrl+V drop zone,
 * same gesture as every other image field in this form. Pasting an image
 * into it deletes the node and inserts a real `<img>` in its place — there
 * is no leftover marker text to forget. `renderHTML` on that node still
 * serializes back to the literal `[IMAGE: ...]` text (inside a data
 * attribute's sibling text node) specifically so `hasUnresolvedImagePrompt`
 * below keeps working unchanged as the publish-time backstop.
 */
export const IMAGE_PROMPT_PATTERN = /\[IMAGE:\s*([^\]]+)\]/g;

/**
 * Existence check only — never call `.test()`/`.exec()` directly on the
 * exported pattern above for this: it carries the `g` flag, which makes
 * `lastIndex` stick between calls on the same instance and silently miss
 * matches on a second check. This always constructs a fresh regex.
 */
export function hasUnresolvedImagePrompt(html: string): boolean {
  return /\[IMAGE:\s*[^\]]+\]/.test(html);
}

/**
 * Converts every `[IMAGE: ...]` text marker in a raw HTML string into a
 * `<div data-image-prompt="...">` placeholder element — run this on any
 * HTML before handing it to the editor (`setContent` or the initial
 * `content` option) so the `imagePrompt` node's `parseHTML` picks it up as
 * a real node instead of the editor just showing it as plain paragraph
 * text. The prompt is percent-encoded into the attribute to sidestep HTML-
 * attribute escaping entirely (quotes, ampersands, etc. in a free-text
 * prompt would otherwise be a minefield).
 */
export function markersToPlaceholderHtml(html: string): string {
  return html.replace(/\[IMAGE:\s*([^\]]+)\]/g, (_match, prompt: string) => {
    return `<div data-image-prompt="${encodeURIComponent(prompt.trim())}"></div>`;
  });
}

/**
 * The 4 real categories + 3 real authors (with bios), inlined into the
 * prompt itself (perktonic workflow, 2026-10-09 — the admin's articles
 * mix topics and it's not always obvious which category/author fits at a
 * glance, so ChatGPT decides it from the actual content and states it in
 * the output, instead of being guessed afterward in the admin UI).
 *
 * Kept in sync by hand with src/config/site.ts's CATEGORIES and
 * prisma/seed.ts's AUTHORS — same documented duplication pattern as those
 * two files already use with each other.
 */
const CATEGORY_AND_AUTHOR_ROSTER = `Categories (pick exactly one, by this exact name):
- Free Samples & Products — legit free samples, product-testing programs, freebie offers
- Internet Secrets & AI Tools — free AI tools, hidden Google features, useful websites
- Rewards, Trials & Digital Perks — gift cards, free trials, cashback apps, digital perks
- Money-Saving Guides — coupon tools, price-history tricks, discounts

Authors (pick exactly one, by this exact name, matching whichever category above fits):
- Alex Carter (writes Internet Secrets & AI Tools, Money-Saving Guides) — hunts down free AI tools, hidden internet tricks and coupon/price-tracking tools that actually save money, testing each one personally.
- Mia Reynolds (writes Free Samples & Products) — requests the free samples and product-testing programs herself, reads the fine print, flags anything that smells like a scam.
- Daniel Brooks (writes Rewards, Trials & Digital Perks) — specializes in the fine print behind rewards, gift cards and free trials: cancellation steps, eligibility rules, the exact date a "free" trial turns into a charge.`;

/**
 * Appended once, at import time, to every stored prompt (see
 * scripts/import-prompt-queue.ts) — not re-assembled at copy time. Reuses
 * the exact "Label: value" format the Import tab already parses
 * (parseMetaBlock).
 */
export const OUTPUT_FORMAT_ADDENDUM = `

---

# FINAL OUTPUT FORMAT — REQUIRED FOR THE PERKTONIC PLATFORM

${CATEGORY_AND_AUTHOR_ROSTER}

After finishing the article (including your own silent editorial pass
above), output it in exactly this format and nothing else — no
explanation before or after it:

Title: <the final headline>
Slug: <a short, lowercase, hyphenated URL slug for the headline>
Meta Description: <one natural sentence for Google search results, under 160 characters>
Keywords: <3-6 comma-separated keywords/phrases this article targets, most important first>
Category: <exact category name from the list above>
Author: <exact author name from the list above>
---
<the complete article body as clean semantic HTML, following every rule above>

Do not add internal links to other articles or hub pages yourself — you
cannot know this site's real URLs or which articles actually exist yet,
and a guessed link will 404. If a category hub link is genuinely useful,
use exactly this form: /category/free-samples, /category/ai-tools,
/category/rewards-perks, or /category/money-saving (never /free-samples/
or similar — categories are always under /category/). For links to other
articles, leave the paragraph without one — the platform's own "Suggested
Internal Links" tool finds real, already-published articles to link to
after pasting.

Wherever the article genuinely needs an image — before or after a
paragraph, never inside one — insert a line on its own, in exactly this
form:

[IMAGE: <a detailed, descriptive prompt for an AI image generator, describing exactly what the photo/illustration should show>]

Use as many of these as the piece actually needs (typically 1-3, beyond the
cover image). Do not include the cover/hero image inside the body HTML — it
is uploaded and attached separately on the platform.`;

/**
 * Splits one pasted ChatGPT reply into the meta block (fed to
 * parseMetaBlock, same as the Import tab) and the article body HTML,
 * on the first line that is exactly "---".
 */
export function splitQuickArticleOutput(raw: string): { metaText: string; bodyHtml: string } {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const idx = lines.findIndex((l) => l.trim() === "---");
  if (idx === -1) return { metaText: raw, bodyHtml: "" };
  return {
    metaText: lines.slice(0, idx).join("\n"),
    bodyHtml: lines
      .slice(idx + 1)
      .join("\n")
      .trim(),
  };
}
