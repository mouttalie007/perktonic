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
const INLINE_IMAGE_MARKER = "[IMAGE-2-HERE]";
const OUTPUT_FORMAT_ADDENDUM = `

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
