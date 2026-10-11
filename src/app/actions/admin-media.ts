"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-admin";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);
const MAX_BYTES = 12 * 1024 * 1024; // 12MB — pre-compression ceiling
const MAX_WIDTH = 2000;

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

/** Shared core — writes to public/uploads, compresses, records a Media row. */
async function performUpload(
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

  const alt = meta.alt?.trim() || null;
  const media = await prisma.media.create({
    data: {
      url: `/uploads/${key}`,
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

/** Form-bound upload for the Media Library page. */
export async function uploadMedia(_prev: UploadState, formData: FormData): Promise<UploadState> {
  await requireUser("AUTHOR");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose an image file." };
  }
  const result = await performUpload(file, {
    alt: String(formData.get("alt") || ""),
    credit: String(formData.get("credit") || ""),
    caption: String(formData.get("caption") || ""),
  });
  return result.status === "success"
    ? { status: "success", message: "Uploaded." }
    : { status: "error", message: result.message };
}

/**
 * Directly callable (not form-bound) — used by paste-to-upload fields in the
 * article editor: click a box, press Ctrl+V, the image uploads immediately.
 */
export async function uploadImageDirect(formData: FormData): Promise<UploadResult> {
  await requireUser("AUTHOR");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "No image found on the clipboard." };
  }
  return performUpload(file, {
    alt: String(formData.get("alt") || ""),
    credit: String(formData.get("credit") || ""),
  });
}

/** Directly callable — used when an editor tweaks an alt text inline (e.g. PasteImageField). */
export async function updateMediaAltDirect(mediaId: string, alt: string): Promise<void> {
  await requireUser("AUTHOR");
  if (!mediaId) return;
  await prisma.media.update({ where: { id: mediaId }, data: { alt: alt.trim() || null } }).catch(() => {});
}

export async function updateMediaMeta(formData: FormData) {
  await requireUser("AUTHOR");
  const id = String(formData.get("id"));
  await prisma.media.update({
    where: { id },
    data: {
      alt: String(formData.get("alt") || "").trim() || null,
      credit: String(formData.get("credit") || "").trim() || null,
      caption: String(formData.get("caption") || "").trim() || null,
    },
  });
  revalidatePath("/adminiyad/media");
}

export async function deleteMedia(formData: FormData) {
  await requireUser("EDITOR");
  const id = String(formData.get("id"));
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) return;

  await prisma.media.delete({ where: { id } }).catch(() => {});
  if (media.provider === "local" && media.storageKey) {
    await unlink(path.join(process.cwd(), "public", "uploads", media.storageKey)).catch(
      () => {},
    );
  }
  revalidatePath("/adminiyad/media");
}
