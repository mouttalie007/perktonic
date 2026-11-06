/**
 * Adds guides exported by scripts/export-articles.mts to the database this runs against (the live one, on the
 * server). Only these guides, their images and their tags are written: everything else is left alone. Safe to run again.
 *
 *   npx tsx --env-file=.env scripts/import-articles.mts <export-dir> [--at slug=ISO ...] [--dry]
 *
 * --at slug=2026-12-21T09:30:00Z gives that guide a (future) publish date, so it goes live on that day.
 */
import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--") && !a.includes("="))!;
const dry = args.includes("--dry");
const at = new Map(args.filter((a) => a.includes("=") && !a.startsWith("--")).map((a) => a.split("=") as [string, string]));
if (!dir) throw new Error("usage: import-articles.mts <export-dir> [slug=ISO ...] [--dry]");

const data = JSON.parse(fs.readFileSync(path.join(dir, "articles.json"), "utf8")) as { articles: Record<string, any>[]; media: Record<string, any>[] };

/** JSON dates back to Date, using the schema to know which fields are dates. */
function revive(model: string, row: Record<string, any>) {
  const fields = Prisma.dmmf.datamodel.models.find((m) => m.name === model)!.fields;
  const out: Record<string, any> = {};
  for (const f of fields) {
    if (f.kind !== "scalar" && f.kind !== "enum") continue;
    const v = row[f.name];
    if (v === undefined) continue;
    out[f.name] = f.type === "DateTime" && v !== null ? new Date(v) : f.type === "Json" && v === null ? Prisma.JsonNull : v;
  }
  return out;
}

for (const m of data.media) {
  const row = revive("Media", m) as Prisma.MediaUncheckedCreateInput;
  console.log(`media ${row.url}`);
  if (!dry) await prisma.media.upsert({ where: { id: row.id! }, update: {}, create: row });
}

for (const a of data.articles) {
  const row = revive("Article", a);
  const category = a.category?.slug ? await prisma.category.findUnique({ where: { slug: a.category.slug }, select: { id: true } }) : null;
  const author = a.author?.slug ? await prisma.author.findUnique({ where: { slug: a.author.slug }, select: { id: true } }) : null;
  if (a.category?.slug && !category) throw new Error(`${a.slug}: category ${a.category.slug} does not exist here`);
  const body = { ...row, categoryId: category?.id ?? null, authorId: author?.id ?? null } as Prisma.ArticleUncheckedCreateInput;
  if (at.has(a.slug)) body.publishedAt = new Date(at.get(a.slug)!);
  console.log(`article ${a.slug} (${body.publishedAt ? new Date(body.publishedAt as Date).toISOString() : "no date"})`);
  if (dry) continue;
  const existing = await prisma.article.findUnique({ where: { slug: a.slug }, select: { id: true } });
  const { id, ...rest } = body;
  const saved = existing
    ? await prisma.article.update({ where: { id: existing.id }, data: rest as Prisma.ArticleUncheckedUpdateInput })
    : await prisma.article.create({ data: { id, ...rest } as Prisma.ArticleUncheckedCreateInput });
  await prisma.articleTag.deleteMany({ where: { articleId: saved.id } });
  for (const t of a.tags ?? []) {
    const tag = await prisma.tag.upsert({ where: { slug: t.tag.slug }, update: {}, create: { slug: t.tag.slug, name: t.tag.name } });
    await prisma.articleTag.create({ data: { articleId: saved.id, tagId: tag.id } });
  }
}
console.log(dry ? "dry run, nothing written" : "done");
process.exit(0);
