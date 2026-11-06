/**
 * Exports guides (with their images, tags and the upload files) from the LOCAL database so that
 * scripts/import-articles.mts can add them to the live database without touching anything else.
 *
 *   npx tsx --env-file=.env scripts/export-articles.mts <out-dir> <slug> [<slug> ...]
 *
 * Writes <out-dir>/articles.json and <out-dir>/uploads.tgz (every file in public/uploads whose name starts with
 * the id of an image the guides use: the original and its -640/-1080/-og variants).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { prisma } from "@/lib/prisma";

const [out, ...slugs] = process.argv.slice(2);
if (!out || slugs.length === 0) {
  console.error("usage: export-articles.mts <out-dir> <slug> [<slug> ...]");
  process.exit(1);
}
fs.mkdirSync(out, { recursive: true });

const articles = await prisma.article.findMany({
  where: { slug: { in: slugs } },
  include: { category: { select: { slug: true } }, author: { select: { slug: true } }, tags: { include: { tag: true } } },
});
const missing = slugs.filter((s) => !articles.some((a) => a.slug === s));
if (missing.length) throw new Error(`not in the local database: ${missing.join(", ")}`);

const mediaIds = new Set<string>();
for (const a of articles) {
  if (a.featuredImageId) mediaIds.add(a.featuredImageId);
  if (a.ogImageId) mediaIds.add(a.ogImageId);
  for (const m of (a.content ?? "").matchAll(/\/uploads\/([0-9a-f-]{36})/g)) mediaIds.add(m[1]);
}
const media = await prisma.media.findMany({ where: { OR: [{ id: { in: [...mediaIds] } }, { url: { in: [...mediaIds].map((i) => `/uploads/${i}.webp`) } }] } });
const uuids = new Set<string>();
for (const m of media) {
  const f = /\/uploads\/([0-9a-f-]{36})/.exec(m.url)?.[1];
  if (f) uuids.add(f);
  const g = /\/uploads\/([0-9a-f-]{36})/.exec(m.ogUrl ?? "")?.[1];
  if (g) uuids.add(g);
}
for (const i of mediaIds) uuids.add(i);

const files = fs.readdirSync("public/uploads").filter((f) => [...uuids].some((u) => f.startsWith(u)));
fs.writeFileSync(path.join(out, "articles.json"), JSON.stringify({ articles, media }, null, 1));
fs.writeFileSync(path.join(out, "files.txt"), files.join("\n"));
execFileSync("tar", ["--force-local", "-czf", path.join(out, "uploads.tgz"), "-C", "public/uploads", "-T", path.join(out, "files.txt")]);
console.log(`exported ${articles.length} articles, ${media.length} media rows, ${files.length} upload files -> ${out}`);
process.exit(0);
