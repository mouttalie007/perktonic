/**
 * One-time data fix (2026-10-09): the 210 already-imported PromptQueueItem
 * rows have the OLD output-format addendum baked into their `promptText`
 * (single [IMAGE-2-HERE] marker, no Keywords line, "VIRALTRENDLY" in the
 * header). Strips everything from that addendum's start marker onward and
 * re-appends the current OUTPUT_FORMAT_ADDENDUM (src/lib/quick-article.ts),
 * so copying any of these prompts into ChatGPT now asks for the new format.
 *
 * Does NOT touch `category` — see the note in scripts/import-prompt-queue.mjs:
 * that's stale for an unrelated, editorial reason (old 14-category names)
 * and isn't a mechanical fix.
 *
 * Safe to run more than once — re-splits on the same marker each time.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SPLIT_MARKER = /\n\n---\n\n# FINAL OUTPUT FORMAT/;

const CATEGORY_AND_AUTHOR_ROSTER = `Categories (pick exactly one, by this exact name):
- Free Samples & Products — legit free samples, product-testing programs, freebie offers
- Internet Secrets & AI Tools — free AI tools, hidden Google features, useful websites
- Rewards, Trials & Digital Perks — gift cards, free trials, cashback apps, digital perks
- Money-Saving Guides — coupon tools, price-history tricks, discounts

Authors (pick exactly one, by this exact name, matching whichever category above fits):
- Alex Carter (writes Internet Secrets & AI Tools, Money-Saving Guides) — hunts down free AI tools, hidden internet tricks and coupon/price-tracking tools that actually save money, testing each one personally.
- Mia Reynolds (writes Free Samples & Products) — requests the free samples and product-testing programs herself, reads the fine print, flags anything that smells like a scam.
- Daniel Brooks (writes Rewards, Trials & Digital Perks) — specializes in the fine print behind rewards, gift cards and free trials: cancellation steps, eligibility rules, the exact date a "free" trial turns into a charge.`;

const NEW_ADDENDUM = `

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

async function main() {
  const rows = await prisma.promptQueueItem.findMany({
    select: { id: true, promptText: true },
  });
  let updated = 0;
  for (const row of rows) {
    const base = row.promptText.split(SPLIT_MARKER)[0];
    const next = base + NEW_ADDENDUM;
    if (next === row.promptText) continue;
    await prisma.promptQueueItem.update({
      where: { id: row.id },
      data: { promptText: next },
    });
    updated++;
  }
  console.log(`updated ${updated} of ${rows.length} prompt(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
