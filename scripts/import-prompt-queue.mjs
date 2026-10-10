/**
 * One-time import of the 210 hand-written ChatGPT prompts under
 * "Articles Titles/{Alex,Daniel,Mia} Prompt/<category>/<title>.txt" into
 * the prompt_queue_items table that the admin's "Quick Article" tab reads
 * from. Idempotent — skips a (writerSlug, title) pair already imported, so
 * re-running after adding new .txt files only imports the new ones.
 *
 *   node scripts/import-prompt-queue.mjs
 */
import { PrismaClient } from "@prisma/client";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();

const ROOT = path.join(import.meta.dirname, "..", "Articles Titles");

// Folder name -> { Author.slug, display name }.
const WRITERS = {
  "Alex Prompt": { slug: "alex-carter", name: "Alex Carter" },
  "Daniel Prompt": { slug: "daniel-brooks", name: "Daniel Brooks" },
  "Mia Prompt": { slug: "mia-reynolds", name: "Mia Reynolds" },
};

// Sub-folder name (as authored) -> real Category.name on the site. Chosen by
// hand, once — the folder names are editorial groupings for the prompt
// author, not our actual 14-category taxonomy (spec vs. reality mismatch,
// same pattern as the WordPress/FilamentPHP assumptions elsewhere in these
// prompts — safe to resolve ourselves rather than import verbatim).
const CATEGORY_MAP = {
  // Alex
  Digital: "Tech",
  "Everyday Discoveries": "Amazing",
  Facts: "Science",
  Internet: "Viral",
  Money: "Money",
  Science: "Science",
  Tech: "Tech",
  // Daniel
  "Celebrity News": "People",
  Entertainment: "Entertainment",
  "Internet Culture": "Viral",
  People: "People",
  "Trending Stories": "Viral",
  "Viral Moments": "Viral",
  // Mia
  Culture: "Culture",
  "Everyday Habits": "Lifestyle",
  "Human Behavior": "Lifestyle",
  "Interesting Experiences": "Lifestyle",
  Lifestyle: "Lifestyle",
  Relationships: "Lifestyle",
  "Social Trends": "Culture",
  Travel: "Travel",
};

// Kept in sync with src/lib/quick-article.ts by hand (a plain Node script
// can't import a TS module without a build step) — if you edit the
// addendum there, mirror the change here before re-running the import.
//
// NOTE (2026-10-09): the CATEGORY_MAP above still resolves to the old
// 14-category taxonomy (Tech, Lifestyle, Viral, ...) from before the
// PerkTonic pivot — none of those match a current Category. The 210
// already-imported rows' `category` strings are stale for the same
// reason (see prisma/fix-prompt-queue-addendum.ts, which only touches
// promptText, not category). Remapping these topics to the 4 PerkTonic
// categories is an editorial decision, not a mechanical fix — intentionally
// left alone until that's decided.
const CATEGORY_AND_AUTHOR_ROSTER = `Categories (pick exactly one, by this exact name):
- Free Samples & Products — legit free samples, product-testing programs, freebie offers
- Internet Secrets & AI Tools — free AI tools, hidden Google features, useful websites
- Rewards, Trials & Digital Perks — gift cards, free trials, cashback apps, digital perks
- Money-Saving Guides — coupon tools, price-history tricks, discounts

Authors (pick exactly one, by this exact name, matching whichever category above fits):
- Alex Carter (writes Internet Secrets & AI Tools, Money-Saving Guides) — hunts down free AI tools, hidden internet tricks and coupon/price-tracking tools that actually save money, testing each one personally.
- Mia Reynolds (writes Free Samples & Products) — requests the free samples and product-testing programs herself, reads the fine print, flags anything that smells like a scam.
- Daniel Brooks (writes Rewards, Trials & Digital Perks) — specializes in the fine print behind rewards, gift cards and free trials: cancellation steps, eligibility rules, the exact date a "free" trial turns into a charge.`;

const OUTPUT_FORMAT_ADDENDUM = `

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
  let imported = 0;
  let skipped = 0;
  let unmappedCategories = new Set();

  for (const [writerFolder, writer] of Object.entries(WRITERS)) {
    const writerDir = path.join(ROOT, writerFolder);
    let categoryDirs;
    try {
      categoryDirs = await readdir(writerDir, { withFileTypes: true });
    } catch {
      console.log(`  (skipping — not found: ${writerDir})`);
      continue;
    }

    for (const catDirent of categoryDirs) {
      if (!catDirent.isDirectory()) continue;
      const rawCategory = catDirent.name;
      const category = CATEGORY_MAP[rawCategory];
      if (!category) {
        unmappedCategories.add(rawCategory);
        continue;
      }

      const catDir = path.join(writerDir, catDirent.name);
      const files = (await readdir(catDir)).filter((f) => f.endsWith(".txt"));

      for (const file of files) {
        const title = file.replace(/\.txt$/, "");

        const existing = await prisma.promptQueueItem.findFirst({
          where: { writerSlug: writer.slug, title },
          select: { id: true },
        });
        if (existing) {
          skipped++;
          continue;
        }

        const raw = await readFile(path.join(catDir, file), "utf-8");
        const promptText = raw.trimEnd() + OUTPUT_FORMAT_ADDENDUM;

        await prisma.promptQueueItem.create({
          data: {
            writerSlug: writer.slug,
            writerName: writer.name,
            category,
            title,
            promptText,
          },
        });
        imported++;
      }
    }
  }

  if (unmappedCategories.size > 0) {
    console.log("⚠ Unmapped category folders (add to CATEGORY_MAP and re-run):");
    for (const c of unmappedCategories) console.log(`  - ${c}`);
  }
  console.log(`✓ Imported ${imported} prompt(s), skipped ${skipped} already-imported.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
