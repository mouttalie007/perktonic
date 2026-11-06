/** Adds a WebP image to the local media library (public/uploads + a Media row), replacing an earlier one with the same title. */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

export async function registerWebp(buffer: Buffer, opts: { id: string; alt: string; caption?: string | null; width: number; height: number; ogPosition?: "top" | "centre" }) {
  const { prisma } = await import("@/lib/prisma");
  const dir = path.join(process.cwd(), "public", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  for (const old of await prisma.media.findMany({ where: { title: opts.id } })) {
    const b = (old.storageKey ?? "").replace(/\.webp$/, "");
    for (const f of [old.storageKey, old.ogUrl?.split("/").pop(), `${b}-640.webp`, `${b}-1080.webp`]) if (f) fs.rmSync(path.join(dir, f), { force: true });
    await prisma.media.delete({ where: { id: old.id } });
  }
  const key = `${randomUUID()}.webp`;
  fs.writeFileSync(path.join(dir, key), buffer);
  const base = key.slice(0, -5);
  for (const w of [640, 1080]) fs.writeFileSync(path.join(dir, `${base}-${w}.webp`), await sharp(buffer).resize({ width: w, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer());
  const ogKey = `${randomUUID()}-og.webp`;
  fs.writeFileSync(path.join(dir, ogKey), await sharp(buffer).resize(1200, 630, { fit: "cover", position: opts.ogPosition ?? "top" }).webp({ quality: 84 }).toBuffer());
  return prisma.media.create({
    data: { url: `/uploads/${key}`, ogUrl: `/uploads/${ogKey}`, storageKey: key, provider: "local", filename: `${opts.id}.webp`, mimeType: "image/webp", fileSize: buffer.length, width: opts.width, height: opts.height, alt: opts.alt, caption: opts.caption ?? null, title: opts.id },
  });
}
