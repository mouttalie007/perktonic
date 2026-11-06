/**
 * Drip publishing with real dates. Keeps the N best-connected guides published (a balanced mix of the
 * categories) and gives every other one a FUTURE publishedAt, so each appears on its own day (the site only
 * shows articles whose publishedAt has passed). Nothing is backdated: a guide's date is the day it goes live.
 *
 *   npx tsx --env-file=.env scripts/schedule-articles.mts [--keep 30] [--start 2026-11-07] [--dry]
 *
 * Ordering: guides that other guides link to come first, categories take turns, 1-3 guides a day at
 * varied times (07:00-18:00 UTC). Run once; running again re-computes from the guides that are still in the future.
 */
import { prisma } from "@/lib/prisma";

const args = process.argv.slice(2);
const opt = (n: string, d: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const KEEP = Number(opt("--keep", "30"));
const dry = args.includes("--dry");
const start = new Date(`${opt("--start", new Date(Date.now() + 86400000).toISOString().slice(0, 10))}T00:00:00Z`);

// small deterministic generator so a dry run and the real run agree
let seed = 20261106;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

const all = await prisma.article.findMany({
  where: { status: "PUBLISHED", publishedAt: { lte: new Date() } },
  select: { id: true, slug: true, content: true, publishedAt: true, category: { select: { slug: true } } },
  orderBy: { publishedAt: "desc" },
});
const inbound = new Map<string, number>();
for (const a of all) {
  for (const m of (a.content ?? "").matchAll(/href="\/(?:blog|story)\/([a-z0-9-]+)/g)) {
    if (m[1] !== a.slug) inbound.set(m[1], (inbound.get(m[1]) ?? 0) + 1);
  }
}
const byCat = new Map<string, typeof all>();
for (const a of all) {
  const k = a.category?.slug ?? "_";
  byCat.set(k, [...(byCat.get(k) ?? []), a]);
}
for (const list of byCat.values()) list.sort((x, y) => (inbound.get(y.slug) ?? 0) - (inbound.get(x.slug) ?? 0));

// round-robin over the categories, best-connected first: this is the publishing order
const order: typeof all = [];
const cats = [...byCat.keys()];
for (let i = 0; order.length < all.length; i++) for (const c of cats) if (byCat.get(c)![i]) order.push(byCat.get(c)![i]);

const keep = order.slice(0, KEEP);
const later = order.slice(KEEP);
console.log(`published articles: ${all.length}; staying live now: ${keep.length}; to schedule: ${later.length}`);
const keepCats: Record<string, number> = {};
for (const a of keep) keepCats[a.category?.slug ?? "_"] = (keepCats[a.category?.slug ?? "_"] ?? 0) + 1;
console.log("kept per category:", JSON.stringify(keepCats));

const plan: { id: string; slug: string; at: Date }[] = [];
let day = 0;
const PER_DAY = [1, 2, 1, 1, 2, 1, 2];
for (let i = 0; i < later.length; day++) {
  const n = Math.min(PER_DAY[day % PER_DAY.length], later.length - i);
  const hours = Array.from({ length: n }, () => 7 + rnd() * 11).sort((a, b) => a - b);
  for (const h of hours) {
    const at = new Date(start.getTime() + day * 86400000 + Math.floor(h * 3600) * 1000 + Math.floor(rnd() * 60) * 1000);
    plan.push({ id: later[i].id, slug: later[i].slug, at });
    i++;
  }
}
console.log(`schedule: ${plan[0]?.at.toISOString()} -> ${plan.at(-1)?.at.toISOString()} over ${day} days`);
for (const p of plan.slice(0, 6)) console.log("  ", p.at.toISOString(), p.slug);

if (!dry) {
  for (const p of plan) await prisma.article.update({ where: { id: p.id }, data: { publishedAt: p.at } });
  console.log(`updated ${plan.length} articles`);
}
process.exit(0);
