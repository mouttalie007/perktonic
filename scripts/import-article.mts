/**
 * Imports an article written to the PerkTonic brief (tools-handbook/ARTICLE-WRITER-BRIEF.md) into the local database.
 *
 *   npx tsx --env-file=.env scripts/import-article.mts <article.md> [--shots <shots.json>] [--cover] [--draft] [--author <slug>] [--skip-links] [--dry]
 *
 *  1. reads the meta block and the Markdown body; finds the [IMAGE n] blocks. Two layouts are accepted:
 *     the block written in place, or a bare `[IMAGE n]` line in the text with its definition (Tool/Setup/Show/Mark/Alt/Caption)
 *     at the end of the file;
 *  2. --shots: runs the screenshot spec. Each shot is { "n": <IMAGE number>, steps, capture, annotate, viewport? }: the tool, the alt text and
 *     the caption come from the image block; images are registered in the media library and placed where the block was;
 *  3. --cover: draws the cover image of the guide (scripts/cover.mts, optional cover.json next to the article) and makes it the featured image;
 *  4. converts Markdown to HTML (`article:<slug>` -> /story/<slug>, external links get rel="nofollow noopener noreferrer"), checks every link
 *     (external ones are fetched), creates or updates the article (published, or --draft), and prints the SEO check.
 * Safe to run again: the article (same slug) is updated and its images are replaced.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { marked } from "marked";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { TOOLS } from "@/config/tools";
import { CATEGORIES } from "@/config/site";
import { readingTimeMinutes } from "@/lib/reading-time";
import { seoCheck } from "@/lib/seo-check";
import { slugify } from "@/lib/slug";
import { registerWebp } from "./media-register.mjs";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const file = args.find((a) => !a.startsWith("--") && ![opt("--shots"), opt("--author")].includes(a));
if (!file) {
  console.error("Usage: npx tsx --env-file=.env scripts/import-article.mts <article.md> [--shots shots.json] [--cover] [--draft] [--author slug] [--skip-links] [--dry]");
  process.exit(1);
}
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const PREVIEW = "http://localhost:3001";
const node = (script: string, ...a: string[]) => execFileSync(process.execPath, ["--import", "tsx", "--env-file=.env", script, ...a], { stdio: "inherit" });

// ------------------------------------------------------------------ 1. read
const raw = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").replace(/^﻿/, "");
const cut = raw.search(/^---\s*$/m);
if (cut < 0) throw new Error("No line with only --- between the meta block and the body.");
const metaText = raw.slice(0, cut);
const bodyText = raw.slice(cut).replace(/^---\s*\n/, "");

const meta: Record<string, string> = {};
for (const line of metaText.split("\n")) {
  const m = line.match(/^([A-Za-z][A-Za-z ]*?):\s*(.*)$/);
  if (m) meta[m[1]!.trim().toLowerCase()] = m[2]!.trim();
}
const need = (k: string) => {
  if (!meta[k]) throw new Error(`The meta block has no "${k}".`);
  return meta[k]!;
};
const title = need("title");
const slug = need("slug");
const metaDescription = need("meta description");
const seoTitle = meta["seo title"] || title;
const primaryKeyword = meta["primary keyword"] ?? "";
const toolSlugs = (meta["tools"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const dir = path.join("content", "articles", slug);
fs.mkdirSync(dir, { recursive: true });

// image blocks
interface Block { n: number; fields: Record<string, string> }
const defs = new Map<number, Block>();
const bodyLines: string[] = [];
{
  const lines = bodyText.split("\n");
  const counts = new Map<number, number>();
  for (const l of lines) {
    const m = l.match(/^\[IMAGE\s+(\d+)\]\s*$/i);
    if (m) counts.set(Number(m[1]), (counts.get(Number(m[1])) ?? 0) + 1);
  }
  const seen = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i]!.match(/^\[IMAGE\s+(\d+)\]\s*$/i);
    if (!open) {
      bodyLines.push(lines[i]!);
      continue;
    }
    const n = Number(open[1]);
    const fields: Record<string, string> = {};
    let last = "";
    let j = i + 1;
    for (; j < lines.length; j++) {
      const l = lines[j]!;
      if (/^\[\/IMAGE\]\s*$/i.test(l) || !l.trim()) break;
      const f = l.match(/^(Tool|Setup|Show|Mark|Alt|Caption):\s*(.*)$/i);
      if (f) {
        last = f[1]!.toLowerCase();
        fields[last] = f[2]!.trim();
      } else if (last) fields[last] += " " + l.trim();
      else break;
    }
    const isDef = Object.keys(fields).length > 0;
    if (isDef) {
      defs.set(n, { n, fields });
      i = j; // skip the definition lines
      // an inline definition (the only occurrence of that number) is also the position in the text
      if ((counts.get(n) ?? 0) === 1) bodyLines.push("", `IMGBLOCKTOKEN${n}`, "");
    } else if (!seen.has(n)) {
      seen.add(n);
      bodyLines.push("", `IMGBLOCKTOKEN${n}`, "");
    }
  }
}
const placeholders = new Set([...bodyLines.join("\n").matchAll(/IMGBLOCKTOKEN(\d+)/g)].map((m) => Number(m[1])));

// ------------------------------------------------------------------ 2. screenshots + cover
const images = new Map<number, { html: string; mediaId: string; url: string }>();
const specPath = opt("--shots") ?? (fs.existsSync(path.join(dir, "shots.json")) && !flag("--dry") ? path.join(dir, "shots.json") : undefined);
if (specPath && !flag("--dry")) {
  const src = JSON.parse(fs.readFileSync(specPath, "utf8")) as { shots: (Record<string, unknown> & { n: number })[] };
  const expanded = src.shots.map(({ n, ...rest }) => {
    const d = defs.get(n);
    return { id: `${slug}-${n}`, tool: d?.fields["tool"], alt: d?.fields["alt"] ?? `${title}, screenshot ${n}`, caption: d?.fields["caption"], ...rest };
  });
  const outDir = path.join(dir, "shots-out");
  const tmp = path.join(dir, "shots.expanded.json");
  fs.writeFileSync(tmp, JSON.stringify({ shots: expanded }, null, 2));
  node("scripts/shots.mts", tmp, "--register", "--out", outDir);
  const manifest = JSON.parse(fs.readFileSync(path.join(outDir, "manifest.json"), "utf8")) as { id: string; mediaId?: string; url?: string; html?: string }[];
  for (const m of manifest) {
    const n = Number(m.id.match(/-(\d+)$/)?.[1]);
    if (n && m.mediaId && m.url && m.html) images.set(n, { html: m.html, mediaId: m.mediaId, url: m.url });
  }
}
let coverMediaId: string | null = null;
if (flag("--cover") && !flag("--dry")) {
  const out = path.join(dir, "cover.webp");
  node("scripts/cover.mts", file, "--out", out);
  const buf = fs.readFileSync(out);
  const info = await sharp(buf).metadata();
  const media = await registerWebp(buf, { id: `cover-${slug}`, alt: `Cover of the guide "${title}"`, caption: null, width: info.width ?? 1200, height: info.height ?? 630, ogPosition: "centre" });
  coverMediaId = media.id;
}
for (const n of defs.keys()) if (!flag("--dry") && !images.has(n)) console.log(`warning: [IMAGE ${n}] has no screenshot; it is left out of the article.`);

// ------------------------------------------------------------------ 3. html
let html = (marked.parse(bodyLines.join("\n"), { gfm: true, async: false }) as string).trim();
html = html.replace(/<p>IMGBLOCKTOKEN(\d+)<\/p>/g, (_m, n: string) => images.get(Number(n))?.html ?? "");
html = html.replace(/href="article:([a-z0-9-]+)"/g, 'href="/story/$1"');
html = html.replace(/<a href="(https?:\/\/[^"]+)"(?![^>]*\brel=)/g, '<a href="$1" rel="nofollow noopener noreferrer" target="_blank"');
if (/IMGBLOCKTOKEN|\[IMAGE/.test(html) && !flag("--dry")) throw new Error("An image placeholder is still in the article.");

// ------------------------------------------------------------------ 4. links
const hrefs = [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, "&"));
const liveTools = new Set(TOOLS.filter((t) => t.status === "live").map((t) => t.slug));
const cats = new Set<string>(CATEGORIES.map((c) => c.slug));
const linkReport: string[] = [];
let linkProblems = 0;
const note = (ok: boolean, text: string) => {
  if (!ok) linkProblems++;
  linkReport.push(`${ok ? "ok  " : "FAIL"} ${text}`);
};
for (const slugOf of toolSlugs) if (!liveTools.has(slugOf)) note(false, `meta Tools: "${slugOf}" is not a live tool`);
for (const h of hrefs) {
  if (h.startsWith("/tools/")) note(liveTools.has(h.slice(7)), h);
  else if (h.startsWith("/category/")) note(cats.has(h.slice(10)), h);
  else if (h.startsWith("/story/")) {
    const exists = !!(await prisma.article.findUnique({ where: { slug: h.slice(7) }, select: { id: true } }));
    linkReport.push(`${exists ? "ok  " : "wait"} ${h}${exists ? "" : "  (guide not imported yet)"}`);
  } else if (/^https?:\/\//.test(h)) {
    if (flag("--skip-links")) {
      linkReport.push(`skip ${h}`);
      continue;
    }
    try {
      const res = await fetch(h, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; PerkTonicLinkCheck/1.0)" }, signal: AbortSignal.timeout(20_000) });
      note(res.ok, `${h}  ->  ${res.status}`);
    } catch (e) {
      note(false, `${h}  ->  ${e instanceof Error ? e.message : "no answer"}`);
    }
  } else if (!h.startsWith("#") && !h.startsWith("mailto:")) note(false, `${h}  (unknown kind of link)`);
}

// ------------------------------------------------------------------ 5. SEO report (always)
const excerpt = (meta["excerpt"] || metaDescription).slice(0, 300);
const checks = seoCheck({ title, slug, excerpt, seoTitle, metaDescription, html, hasFeaturedImage: !!coverMediaId || flag("--dry"), siteHost: new URL(SITE_URL).hostname });
const seoLines = checks.map((c) => `  ${c.status === "ok" ? "ok  " : c.status === "warn" ? "warn" : "BAD "} ${c.label}: ${c.detail}`);
const problems = checks.filter((c) => c.status !== "ok");
if (flag("--dry")) {
  console.log(`\nDRY RUN "${title}"\nLinks:\n  ${linkReport.join("\n  ")}\nSEO check:\n${seoLines.join("\n")}`);
  await prisma.$disconnect();
  process.exit(0);
}

// ------------------------------------------------------------------ 6. database
const category = await prisma.category.findFirst({ where: { slug: need("category slug") } });
if (!category) throw new Error(`No category with slug "${meta["category slug"]}".`);
const authorSlug = opt("--author") ?? "perktonic-team";
let author = await prisma.author.findUnique({ where: { slug: authorSlug } });
if (!author && authorSlug === "perktonic-team") {
  author = await prisma.author.create({ data: { slug: "perktonic-team", name: "PerkTonic Team", role: "Editorial team", bio: "The PerkTonic team writes and maintains the free tools and the technical guides on this site." } });
}
if (!author) throw new Error(`No author "${authorSlug}".`);

const tagNames = (meta["tags"] ? meta["tags"].split(",").map((s) => s.trim()).filter(Boolean) : toolSlugs.map((s) => TOOLS.find((t) => t.slug === s)?.name).filter((n): n is string => !!n)).slice(0, 4);
const tagIds: string[] = [];
for (const name of tagNames) {
  const tag = await prisma.tag.upsert({ where: { slug: slugify(name) }, update: {}, create: { slug: slugify(name), name } });
  tagIds.push(tag.id);
}
const publish = !flag("--draft");
const existing = await prisma.article.findUnique({ where: { slug }, select: { id: true, publishedAt: true, featuredImageId: true } });
const data = {
  type: "STANDARD" as const,
  title,
  slug,
  excerpt,
  content: html,
  categoryId: category.id,
  authorId: author.id,
  status: publish ? ("PUBLISHED" as const) : ("DRAFT" as const),
  publishedAt: publish ? (existing?.publishedAt ?? new Date()) : null,
  readingTime: readingTimeMinutes(html),
  seoTitle,
  metaDescription,
  featuredImageId: coverMediaId ?? existing?.featuredImageId ?? null,
  robotsIndex: true,
  robotsFollow: true,
};
const article = existing ? await prisma.article.update({ where: { id: existing.id }, data }) : await prisma.article.create({ data });
await prisma.articleTag.deleteMany({ where: { articleId: article.id } });
await prisma.articleTag.createMany({ data: tagIds.map((tagId) => ({ articleId: article.id, tagId })) });

// ------------------------------------------------------------------ 7. report
fs.writeFileSync(path.join(dir, "article.html"), html);
console.log(`\n${existing ? "Updated" : "Created"} "${title}" (${publish ? "published" : "draft"}, ${article.readingTime} min, ${images.size}/${defs.size} image(s), cover: ${coverMediaId ? "yes" : "no"})`);
console.log("\nLinks:\n  " + linkReport.join("\n  "));
console.log("\nSEO check:\n" + seoLines.join("\n"));
console.log(`\nKeyword: ${primaryKeyword}\nArticle:  ${PREVIEW}/story/${slug}\nAdmin:    ${PREVIEW}/adminiyad/articles/${article.id}/edit`);
fs.appendFileSync(path.join("content", "articles", "_report.jsonl"), JSON.stringify({ at: new Date().toISOString(), slug, title, images: images.size, linkProblems, seoProblems: problems.map((p) => `${p.status}:${p.id}`), placeholdersMissing: [...defs.keys()].filter((n) => !placeholders.has(n)) }) + "\n");
await prisma.$disconnect();
process.exit(linkProblems ? 2 : 0);
