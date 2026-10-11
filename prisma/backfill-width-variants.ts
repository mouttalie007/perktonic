// One-time backfill: generates the 640w/1080w responsive variants for every
// existing local .webp Media row that's missing them (uploaded before this
// feature shipped). Safe to re-run -- skips a variant that already exists
// on disk. Must match RESPONSIVE_WIDTHS in src/app/actions/admin-media.ts
// and the thresholds in src/lib/image-loader.ts.
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../src/lib/prisma";

const RESPONSIVE_WIDTHS = [640, 1080];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findLocalWebpRows() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await prisma.media.findMany({
        where: { provider: "local", storageKey: { endsWith: ".webp" } },
        select: { id: true, storageKey: true, filename: true },
      });
    } catch (e) {
      console.error(`findMany attempt ${attempt} failed:`, e instanceof Error ? e.message : e);
      if (attempt === 3) throw e;
      await sleep(3000);
    }
  }
  throw new Error("unreachable");
}

async function fileExists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const rows = await findLocalWebpRows();
  console.log(`Checking ${rows.length} local .webp media row(s) for missing responsive variants.`);

  const dir = path.join(process.cwd(), "public", "uploads");
  let generated = 0;
  for (const row of rows) {
    const baseKey = row.storageKey!.slice(0, -".webp".length);
    const originalPath = path.join(dir, row.storageKey!);
    let original: Buffer | null = null;

    for (const targetWidth of RESPONSIVE_WIDTHS) {
      const variantPath = path.join(dir, `${baseKey}-${targetWidth}.webp`);
      if (await fileExists(variantPath)) continue;
      try {
        original ??= await readFile(originalPath);
        const variantBuffer = await sharp(original)
          .rotate()
          .resize({ width: targetWidth, withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();
        await writeFile(variantPath, variantBuffer);
        generated++;
      } catch (e) {
        console.error(`Skipped ${row.id} @ ${targetWidth}w (${row.filename}):`, e instanceof Error ? e.message : e);
      }
    }
  }
  console.log(`Generated ${generated} variant file(s).`);
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
