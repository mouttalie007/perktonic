// One-time backfill: generates the 1200x630 og variant for every existing
// local Media row that doesn't have one yet (uploaded before this feature
// shipped). Safe to re-run -- skips rows that already have ogUrl.
//
// Retries its first query once: this runs right after several other
// short-lived Prisma CLI/Client processes (generate, migrate deploy,
// import-prompt-queue.mjs) in the same deploy script, and spawning yet
// another fresh query engine that soon after has occasionally hit a
// transient Rust panic ("timer has gone away") on this host -- not a real
// data problem, just resource contention from launching so many engine
// processes back to back.
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../src/lib/prisma";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findMissingRows() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await prisma.media.findMany({
        where: { provider: "local", ogUrl: null, storageKey: { not: null } },
      });
    } catch (e) {
      console.error(`findMany attempt ${attempt} failed:`, e instanceof Error ? e.message : e);
      if (attempt === 3) throw e;
      await sleep(3000);
    }
  }
  throw new Error("unreachable");
}

async function main() {
  const rows = await findMissingRows();
  console.log(`Found ${rows.length} media row(s) missing an og variant.`);

  const dir = path.join(process.cwd(), "public", "uploads");
  let done = 0;
  for (const row of rows) {
    try {
      const original = await readFile(path.join(dir, row.storageKey!));
      const ogBuffer = await sharp(original)
        .rotate()
        .resize(OG_WIDTH, OG_HEIGHT, { fit: "cover", position: "centre" })
        .webp({ quality: 82 })
        .toBuffer();
      const ogKey = `${randomUUID()}-og.webp`;
      await writeFile(path.join(dir, ogKey), ogBuffer);
      await prisma.media.update({ where: { id: row.id }, data: { ogUrl: `/uploads/${ogKey}` } });
      done++;
    } catch (e) {
      console.error(`Skipped ${row.id} (${row.filename}):`, e instanceof Error ? e.message : e);
    }
  }
  console.log(`Backfilled ${done}/${rows.length}.`);
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
