import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Image upload pipeline (compress to WebP, 1200x630 og crop, 640/1080
 * responsive variants, Media row). Lives here -- not in the "use server"
 * actions file -- so more than one server action can reuse it WITHOUT it
 * becoming a directly-callable endpoint itself: every export of a
 * "use server" file is a public Server Action, and this function does no
 * auth check of its own (each caller does, via requireUser).
 */
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);
const MAX_BYTES = 12 * 1024 * 1024; // 12MB — pre-compression ceiling
const MAX_WIDTH = 2000;
const OG_WIDTH = 1200;
const OG_HEIGHT = 630; // 1.91:1 — the aspect ratio social platforms expect
export const RESPONSIVE_WIDTHS = [640, 1080]; // must match src/lib/image-loader.ts's thresholds

export type UploadState = { status: "idle" | "error" | "success"; message?: string };
export type UploadResult = {
  status: "success" | "error";
  message?: string;
  media?: { id: string; url: string; alt: string | null; width: number | null; height: number | null };
};

/**
 * Compresses to WebP (spec §15, §43 — modern formats, small payloads).
 * Animated GIFs are kept as GIF untouched (WebP re-encoding would collapse
 * them to a still frame with the plain sharp() pipeline below).
 */
async function compressImage(
  buffer: Buffer,
  mimeType: string,
): Promise<{ buffer: Buffer; mimeType: string; ext: string; width: number | null; height: number | null }> {
  if (mimeType === "image/gif") {
    const meta = await sharp(buffer).metadata().catch(() => null);
    return { buffer, mimeType, ext: ".gif", width: meta?.width ?? null, height: meta?.height ?? null };
  }
  const img = sharp(buffer).rotate();
  const meta = await img.metadata();
  const pipeline = meta.width && meta.width > MAX_WIDTH ? img.resize({ width: MAX_WIDTH }) : img;
  const { data, info } = await pipeline.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  return { buffer: data, mimeType: "image/webp", ext: ".webp", width: info.width, height: info.height };
}

/**
 * 1200x630 center-cropped WebP for social share previews only (spec: link
 * unfurls on Facebook/X/LinkedIn expect exactly 1.91:1, or they crop it
 * awkwardly). Built once at upload time, never on page render — no runtime
 * cost. Always a static frame, even for an animated GIF source.
 */
async function buildOgVariant(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(OG_WIDTH, OG_HEIGHT, { fit: "cover", position: "centre" })
    .webp({ quality: 82 })
    .toBuffer();
}

/**
 * A narrower-width WebP copy for small viewports (spec: PageSpeed flagged
 * every image serving full size to mobile). `withoutEnlargement` means a
 * source already narrower than `targetWidth` is written unchanged, so the
 * file is guaranteed to exist for the loader to reference either way.
 */
async function buildWidthVariant(buffer: Buffer, targetWidth: number): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize({ width: targetWidth, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
}

/** Shared core — writes to public/uploads, compresses, records a Media row. */
export async function performUpload(
  file: File,
  meta: { alt?: string; credit?: string; caption?: string },
): Promise<UploadResult> {
  if (!ALLOWED_TYPES.has(file.type)) {
    return { status: "error", message: "Unsupported file type. Use JPEG, PNG, WebP, AVIF or GIF." };
  }
  if (file.size > MAX_BYTES) {
    return { status: "error", message: "File is too large (max 12MB)." };
  }

  const original = Buffer.from(await file.arrayBuffer());
  const { buffer, mimeType, ext, width, height } = await compressImage(original, file.type);

  const key = `${randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, key), buffer);

  let ogUrl: string | null = null;
  const ogBuffer = await buildOgVariant(original).catch(() => null);
  if (ogBuffer) {
    const ogKey = `${randomUUID()}-og.webp`;
    await writeFile(path.join(dir, ogKey), ogBuffer);
    ogUrl = `/uploads/${ogKey}`;
  }

  // Responsive width variants -- GIFs stay untouched (ext !== ".webp"); the
  // loader only ever looks for a "-640"/"-1080" sibling of a .webp file.
  if (ext === ".webp") {
    const baseKey = key.slice(0, -".webp".length);
    for (const targetWidth of RESPONSIVE_WIDTHS) {
      const variantBuffer = await buildWidthVariant(buffer, targetWidth).catch(() => null);
      if (variantBuffer) {
        await writeFile(path.join(dir, `${baseKey}-${targetWidth}.webp`), variantBuffer);
      }
    }
  }

  const alt = meta.alt?.trim() || null;
  const media = await prisma.media.create({
    data: {
      url: `/uploads/${key}`,
      ogUrl,
      storageKey: key,
      provider: "local",
      filename: file.name,
      mimeType,
      fileSize: buffer.length,
      width,
      height,
      alt,
      credit: meta.credit?.trim() || null,
      caption: meta.caption?.trim() || null,
    },
  });

  revalidatePath("/adminiyad/media");
  return {
    status: "success",
    media: { id: media.id, url: media.url, alt: media.alt, width: media.width, height: media.height },
  };
}

