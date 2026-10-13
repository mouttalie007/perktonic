/**
 * Imports the article briefs of every "Content Command Center" HTML file in
 * content/briefs/ into the article_briefs table that the admin's "API
 * Articles" page reads from (2026-10-13).
 *
 *   node scripts/import-article-briefs.mjs [file.html ...]
 *
 * Idempotent. A brief already in the table keeps its status, notes, draft
 * and images; only its brief data (keywords, angle, related links...) is
 * refreshed, so re-running after editing the HTML is safe. Each file is
 * evaluated in an empty vm sandbox up to its "STATE" marker (the part that
 * only defines data and prompt text, never touching the DOM) -- the files
 * are the owner's own, trusted, hand-managed content.
 */
import { PrismaClient } from "@prisma/client";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const prisma = new PrismaClient();
const DIR = path.join(import.meta.dirname, "..", "content", "briefs");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sourceName(file) {
  const m = path.basename(file).match(/part[-_ ]?(\d+)/i);
  return m ? `part${m[1]}` : path.basename(file, path.extname(file));
}

function extractData(html) {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("no <script> block");
  const full = m[1];
  const cut = full.indexOf("/* ---------- STATE ---------- */");
  const code = cut > 0 ? full.slice(0, cut) : full;
  const ctx = vm.createContext({});
  vm.runInContext(`${code}\n;this.__out={A:typeof A!=="undefined"?A:null,PUB:typeof PUB!=="undefined"?PUB:{}};`, ctx);
  if (!Array.isArray(ctx.__out.A)) throw new Error("no article array `A` found");
  return { articles: ctx.__out.A, published: ctx.__out.PUB ?? {} };
}

function resolveRel(rel, articles, published) {
  return (rel ?? [])
    .map((ref) => {
      const r = typeof ref === "string" ? published[ref] : articles.find((a) => a.id === ref);
      return r ? { title: r.title, pk: r.pk } : null;
    })
    .filter(Boolean);
}

async function importFile(file) {
  const source = sourceName(file);
  const { articles, published } = extractData(await readFile(file, "utf8"));
  let created = 0;
  let updated = 0;

  for (const a of articles) {
    const data = { ...a, relResolved: resolveRel(a.rel, articles, published) };
    const existing = await prisma.articleBrief.findUnique({
      where: { source_briefNo: { source, briefNo: a.id } },
      select: { id: true, status: true },
    });
    if (!existing) {
      await prisma.articleBrief.create({
        data: { source, briefNo: a.id, title: a.title, categoryKey: a.cat, data },
      });
      created++;
    } else {
      const fresh = existing.status === "PENDING" || existing.status === "FAILED";
      await prisma.articleBrief.update({
        where: { id: existing.id },
        data: { data, categoryKey: a.cat, ...(fresh ? { title: a.title } : {}) },
      });
      updated++;
    }
  }
  console.log(`✓ ${path.basename(file)} (${source}): ${created} new, ${updated} refreshed, ${articles.length} total.`);
}

async function main() {
  const args = process.argv.slice(2);
  const files = args.length
    ? args.map((f) => path.resolve(f))
    : (await readdir(DIR)).filter((f) => f.toLowerCase().endsWith(".html")).map((f) => path.join(DIR, f));

  if (files.length === 0) {
    console.log("No brief files found in content/briefs/.");
    return;
  }
  // This runs right after several other Prisma processes in the deploy
  // script; one retry covers the occasional engine-startup hiccup on the
  // shared host (same reason as prisma/backfill-og-variants.ts).
  for (const file of files) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await importFile(file);
        break;
      } catch (e) {
        console.error(`attempt ${attempt} failed for ${path.basename(file)}:`, e instanceof Error ? e.message : e);
        if (attempt === 3) throw e;
        await sleep(3000);
      }
    }
  }
}

main()
  .catch((e) => {
    console.error("Brief import failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
