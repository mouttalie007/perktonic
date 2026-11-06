/**
 * Re-plans the guides that are still scheduled (publishedAt in the future): the first N go live right now
 * (their publish date is the moment this runs), the rest are spread over the following days, K per day at
 * spaced times. Dates are never moved into the past: a guide's date is the day it really went live.
 *
 *   npx tsx --env-file=.env scripts/reschedule-articles.mts --live-now 32 --per-day 4 [--start 2026-11-07] [--dry]
 */
import { prisma } from "@/lib/prisma";

const args = process.argv.slice(2);
const opt = (n: string, d: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const LIVE_NOW = Number(opt("--live-now", "0"));
const PER_DAY = Number(opt("--per-day", "4"));
const dry = args.includes("--dry");
const now = new Date();
const start = new Date(`${opt("--start", new Date(now.getTime() + 86400000).toISOString().slice(0, 10))}T00:00:00Z`);

let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

const pending = await prisma.article.findMany({
  where: { status: "PUBLISHED", publishedAt: { gt: now } },
  select: { id: true, slug: true, publishedAt: true },
  orderBy: { publishedAt: "asc" },
});
const published = await prisma.article.count({ where: { status: "PUBLISHED", publishedAt: { lte: now } } });
console.log(`live: ${published}; scheduled: ${pending.length}`);

const goNow = pending.slice(0, LIVE_NOW);
const later = pending.slice(LIVE_NOW);
// K slots a day, spaced across 07:00-19:00 UTC with a little jitter so they are not on the dot
const slotBase = Array.from({ length: PER_DAY }, (_, i) => 7 + (12 * (i + 0.5)) / PER_DAY);
const plan = later.map((a, i) => {
  const day = Math.floor(i / PER_DAY);
  const slot = slotBase[i % PER_DAY] + (rnd() - 0.5) * 1.2;
  const at = new Date(start.getTime() + day * 86400000 + Math.round(slot * 3600) * 1000);
  return { ...a, at };
});
console.log(`going live now: ${goNow.length}; re-scheduled: ${plan.length} (${plan[0]?.at.toISOString()} -> ${plan.at(-1)?.at.toISOString()})`);
for (const p of plan.slice(0, 5)) console.log("  ", p.at.toISOString(), p.slug);
console.log(`will be live after this run: ${published + goNow.length}`);

if (!dry) {
  for (const a of goNow) await prisma.article.update({ where: { id: a.id }, data: { publishedAt: new Date() } });
  for (const p of plan) await prisma.article.update({ where: { id: p.id }, data: { publishedAt: p.at } });
  console.log("updated");
}
process.exit(0);
