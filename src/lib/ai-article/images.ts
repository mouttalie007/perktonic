import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { performUpload } from "@/lib/media-upload";
import { applyDemoEngagementToArticle } from "@/lib/demo-engagement";
import { hasUnresolvedImagePrompt } from "@/lib/quick-article";
import { asSlots, type ImageSlot } from "./slots";

/**
 * The <img> that replaces an [IMAGE: ...] tag once its picture is pasted:
 * explicit width/height (no layout shift), lazy + async decoding, and a
 * srcset over the 640w/1080w variants every upload gets (see
 * src/lib/media-upload.ts) so phones don't download the full-size file.
 * Body images are rendered as raw HTML (not next/image), which is why the
 * srcset is written here.
 */
export function buildBodyImgTag(
  media: { url: string; width: number | null; height: number | null },
  alt: string,
): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const attrs = [`src="${media.url}"`];

  if (media.url.endsWith(".webp") && media.width) {
    const base = media.url.slice(0, -".webp".length);
    const w = media.width;
    const entries: [number, string][] = [
      [Math.min(640, w), `${base}-640.webp`],
      [Math.min(1080, w), `${base}-1080.webp`],
      [w, media.url],
    ];
    const seen = new Set<number>();
    const parts: string[] = [];
    for (const [descriptor, url] of entries) {
      if (seen.has(descriptor)) continue;
      seen.add(descriptor);
      parts.push(`${url} ${descriptor}w`);
    }
    if (parts.length > 1) {
      attrs.push(`srcset="${parts.join(", ")}"`, `sizes="(max-width: 768px) 100vw, 744px"`);
    }
  }

  attrs.push(`alt="${esc(alt)}"`);
  if (media.width && media.height) attrs.push(`width="${media.width}"`, `height="${media.height}"`);
  attrs.push(`loading="lazy"`, `decoding="async"`);
  return `<img ${attrs.join(" ")}>`;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type AttachResult = { ok: true; slots: ImageSlot[] } | { ok: false; error: string };

/**
 * Uploads a pasted image (compressed to WebP like every upload) and puts it
 * where its slot says: slot 0 becomes the article's featured image, any
 * other slot replaces its [IMAGE: ...] tag in the body (or the earlier
 * <img> if the admin is redoing that slot).
 */
export async function attachSlotImage(briefId: string, slotIndex: number, file: File): Promise<AttachResult> {
  const brief = await prisma.articleBrief.findUnique({ where: { id: briefId }, include: { article: true } });
  if (!brief?.article) return { ok: false, error: "This brief has no draft article yet." };
  if (brief.status !== "DRAFTED") return { ok: false, error: "Images can only be added while the article is a draft." };

  const slots = asSlots(brief.imageSlots);
  const slot = slots[slotIndex];
  if (!slot) return { ok: false, error: "Unknown image slot." };

  const upload = await performUpload(file, { alt: slot.alt });
  if (upload.status !== "success" || !upload.media) {
    return { ok: false, error: upload.message ?? "The upload failed." };
  }
  const media = upload.media;

  if (slot.kind === "cover") {
    await prisma.article.update({ where: { id: brief.article.id }, data: { featuredImageId: media.id } });
  } else {
    let content = brief.article.content ?? "";
    const tag = buildBodyImgTag(media, slot.alt);
    if (slot.url) {
      const earlier = new RegExp(`<img\\b[^>]*\\bsrc="${escapeRegExp(slot.url)}"[^>]*>`);
      if (!earlier.test(content)) {
        return { ok: false, error: "Couldn't find the earlier image in the article any more (it was edited). Replace it in the article editor." };
      }
      content = content.replace(earlier, () => tag);
    } else {
      const marker = `[IMAGE: ${slot.prompt}]`;
      if (!content.includes(marker)) {
        return { ok: false, error: "This slot's [IMAGE] placeholder isn't in the article any more (it was edited). Use the article editor." };
      }
      content = content.replace(marker, () => tag);
    }
    await prisma.article.update({ where: { id: brief.article.id }, data: { content } });
  }

  const updated = slots.map((s, i) => (i === slotIndex ? { ...s, mediaId: media.id, url: media.url } : s));
  await prisma.articleBrief.update({
    where: { id: briefId },
    data: { imageSlots: updated as unknown as Prisma.InputJsonValue },
  });
  revalidatePath("/adminiyad/ai-articles");
  return { ok: true, slots: updated };
}

export type PublishResult =
  | { ok: true; slug: string; warnings: string[] }
  | { ok: false; error: string };

/** Makes a fully-imaged draft live. */
export async function publishBrief(briefId: string, publishedAt: Date): Promise<PublishResult> {
  const brief = await prisma.articleBrief.findUnique({
    where: { id: briefId },
    include: { article: { include: { category: { select: { slug: true } } } } },
  });
  if (!brief?.article) return { ok: false, error: "This brief has no draft article yet." };
  if (brief.status === "PUBLISHED") return { ok: false, error: "Already published." };
  if (brief.status !== "DRAFTED") return { ok: false, error: "Only a finished draft can be published." };

  const slots = asSlots(brief.imageSlots);
  const missing = slots.findIndex((s) => !s.url);
  if (missing >= 0) {
    return { ok: false, error: `Image ${missing + 1} of ${slots.length} is still missing. Finish the images first.` };
  }
  const article = brief.article;
  if (hasUnresolvedImagePrompt(article.content ?? "")) {
    return { ok: false, error: "The article still contains an unresolved [IMAGE: ...] placeholder." };
  }
  if (!article.featuredImageId) return { ok: false, error: "The article has no featured image." };

  // Internal links the sanitizer allowed because they point at a *planned*
  // sibling -- tell the admin which of them aren't live yet (non-blocking).
  const warnings: string[] = [];
  const hrefs = [...(article.content ?? "").matchAll(/<a href="(\/story\/[^"#?]+)"/g)].map((m) => m[1]);
  if (hrefs.length) {
    const slugs = [...new Set(hrefs.map((h) => h.replace("/story/", "")))];
    const live = await prisma.article.findMany({
      where: { slug: { in: slugs }, status: "PUBLISHED" },
      select: { slug: true },
    });
    const liveSet = new Set(live.map((a) => a.slug));
    for (const s of slugs) {
      if (!liveSet.has(s)) warnings.push(`Links to /story/${s}, which isn't published yet (it will work once that article goes live).`);
    }
  }

  await prisma.article.update({
    where: { id: article.id },
    data: { status: "PUBLISHED", publishedAt },
  });
  await prisma.articleBrief.update({ where: { id: briefId }, data: { status: "PUBLISHED" } });

  // Same as a brand-new article published from the editor: seed demo engagement.
  await applyDemoEngagementToArticle(article.id, publishedAt).catch(() => {
    /* non-critical: the article is already live */
  });

  revalidatePath(`/story/${article.slug}`);
  revalidatePath("/");
  if (article.category?.slug) revalidatePath(`/category/${article.category.slug}`);
  revalidatePath("/adminiyad/articles");
  revalidatePath("/adminiyad/ai-articles");
  return { ok: true, slug: article.slug, warnings };
}
