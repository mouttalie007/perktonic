// One-time backfill: generates the 1200x630 og variant for every existing
// local Media row that doesn't have one yet (uploaded before this feature
// shipped). Safe to re-run -- skips rows that already have ogUrl.
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../src/lib/prisma";

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

async function main() {
  const rows = await prisma.media.findMany({
    where: { provider: "local", ogUrl: null, storageKey: { not: null } },
  });
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
  .catch(console.error)
  .finally(() => prisma.$disconnect());
