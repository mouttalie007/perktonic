/**
 * Quick Article (2026-09-28) — a manual-but-fast workflow: copy a
 * pre-written prompt, paste it into ChatGPT, paste the reply back here.
 * No API costs (reuses the editor's existing ChatGPT subscription, which
 * already includes live web search + image generation), no bot to run or
 * maintain — see the "Quick Article" discussion in project memory for why
 * this won out over a fully automated pipeline.
 */

/** Literal marker ChatGPT is instructed to place where the in-article image goes. */
export const INLINE_IMAGE_MARKER = "[IMAGE-2-HERE]";

/**
 * Appended once, at import time, to every stored prompt (see
 * scripts/import-prompt-queue.ts) — not re-assembled at copy time. Reuses
 * the exact "Label: value" format the Import tab already parses
 * (parseMetaBlock), minus a keywords field (dropped — not worth the extra
 * copy/paste step; Google hasn't used meta keywords for years anyway).
 */
export const OUTPUT_FORMAT_ADDENDUM = `

---

# FINAL OUTPUT FORMAT — REQUIRED FOR THE VIRALTRENDLY PLATFORM

After finishing the article (including your own silent editorial pass
above), output it in exactly this format and nothing else — no
explanation before or after it:

Title: <the final headline>
Slug: <a short, lowercase, hyphenated URL slug for the headline>
Meta Description: <one natural sentence for Google search results, under 160 characters>
---
<the complete article body as clean semantic HTML, following every rule above>

Insert the exact text ${INLINE_IMAGE_MARKER} on its own line at the one point
inside the body where the second, in-article image belongs.

Do not include the cover/hero image inside the body HTML — it is uploaded
and attached separately on the platform.`;

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
