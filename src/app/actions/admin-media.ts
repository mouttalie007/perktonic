"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-admin";
import { performUpload, RESPONSIVE_WIDTHS, type UploadResult, type UploadState } from "@/lib/media-upload";

export type { UploadResult, UploadState };

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
  if (media.provider === "local" && media.ogUrl) {
    await unlink(path.join(process.cwd(), "public", media.ogUrl)).catch(() => {});
  }
  if (media.provider === "local" && media.storageKey?.endsWith(".webp")) {
    const baseKey = media.storageKey.slice(0, -".webp".length);
    for (const targetWidth of RESPONSIVE_WIDTHS) {
      await unlink(path.join(process.cwd(), "public", "uploads", `${baseKey}-${targetWidth}.webp`)).catch(
        () => {},
      );
    }
  }
  revalidatePath("/adminiyad/media");
}
