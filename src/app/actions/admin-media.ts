"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
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
const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export type UploadState = { status: "idle" | "error" | "success"; message?: string };

/**
 * Local-disk upload (spec §15, §42, §68). Writes to public/uploads and
 * records a Media row. Swapping MEDIA_PROVIDER to r2/cloudinary later means
 * changing this one function's write target, not the calling forms.
 */
export async function uploadMedia(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  await requireUser("AUTHOR");
  const file = formData.get("file");
  const alt = String(formData.get("alt") || "").trim();
  const credit = String(formData.get("credit") || "").trim();
  const caption = String(formData.get("caption") || "").trim();

  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose an image file." };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { status: "error", message: "Unsupported file type. Use JPEG, PNG, WebP, AVIF or GIF." };
  }
  if (file.size > MAX_BYTES) {
    return { status: "error", message: "File is too large (max 8MB)." };
  }

  const ext = path.extname(file.name).toLowerCase() || "";
  const key = `${randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, key), buffer);

  await prisma.media.create({
    data: {
      url: `/uploads/${key}`,
      storageKey: key,
      provider: "local",
      filename: file.name,
      mimeType: file.type,
      fileSize: file.size,
      alt: alt || null,
      credit: credit || null,
      caption: caption || null,
    },
  });

  revalidatePath("/admin/media");
  return { status: "success", message: "Uploaded." };
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
  revalidatePath("/admin/media");
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
  revalidatePath("/admin/media");
}
