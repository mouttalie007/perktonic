/**
 * Guides moved from /story/<slug> to /blog/<slug> (2026-11-06). Rewrites the internal links stored in the
 * database (article bodies, excerpts, listicle items, static pages). Safe to run again.
 *
 *   npx tsx --env-file=.env scripts/rewrite-story-links.mts [--dry]
 */
import { prisma } from "@/lib/prisma";

const dry = process.argv.includes("--dry");
const swap = (s: string | null) => (s ? s.split('href="/story/').join('href="/blog/').split("perktonic.com/story/").join("perktonic.com/blog/") : s);

let n = 0;
for (const a of await prisma.article.findMany({ where: { OR: [{ content: { contains: "/story/" } }, { excerpt: { contains: "/story/" } }] }, select: { id: true, content: true, excerpt: true } })) {
  n++;
  if (!dry) await prisma.article.update({ where: { id: a.id }, data: { content: swap(a.content), excerpt: swap(a.excerpt) } });
}
console.log(`articles rewritten: ${n}`);

let m = 0;
for (const p of await prisma.page.findMany({ where: { content: { contains: "/story/" } }, select: { id: true, content: true } })) {
  m++;
  if (!dry) await prisma.page.update({ where: { id: p.id }, data: { content: swap(p.content) ?? "" } });
}
console.log(`pages rewritten: ${m}`);

let k = 0;
for (const i of await prisma.listicleItem.findMany({ where: { description: { contains: "/story/" } }, select: { id: true, description: true } })) {
  k++;
  if (!dry) await prisma.listicleItem.update({ where: { id: i.id }, data: { description: swap(i.description) ?? "" } });
}
console.log(`listicle items rewritten: ${k}`);
process.exit(0);
