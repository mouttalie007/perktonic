"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-admin";
import { readingTimeMinutes, listicleReadingTimeMinutes } from "@/lib/reading-time";

export type SaveState = { status: "idle" | "error"; message?: string };

const baseFields = {
  title: z.string().trim().min(1, "Title is required"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
  excerpt: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  authorId: z.string().trim().optional(),
  featuredImageId: z.string().trim().optional(),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"]),
  publishedAt: z.string().trim().optional(),
  isFeatured: z.coerce.boolean().optional(),
  isTrending: z.coerce.boolean().optional(),
  isBreaking: z.coerce.boolean().optional(),
  manualPriority: z.string().trim().optional(),
  adsDisabled: z.coerce.boolean().optional(),
  seoTitle: z.string().trim().optional(),
  metaDescription: z.string().trim().optional(),
  canonicalUrl: z.string().trim().optional(),
  robotsIndex: z.coerce.boolean().optional(),
  robotsFollow: z.coerce.boolean().optional(),
};

const standardSchema = z.object({
  ...baseFields,
  content: z.string().optional(),
});

const listicleSchema = z.object({
  ...baseFields,
  intro: z.string().trim().optional(),
  listicleIndexSubpages: z.coerce.boolean().optional(),
});

function commonData(v: z.infer<typeof standardSchema>) {
  return {
    title: v.title,
    slug: v.slug,
    excerpt: v.excerpt || null,
    categoryId: v.categoryId || null,
    authorId: v.authorId || null,
    featuredImageId: v.featuredImageId || null,
    status: v.status,
    publishedAt:
      v.status === "PUBLISHED" || v.status === "SCHEDULED"
        ? v.publishedAt
          ? new Date(v.publishedAt)
          : new Date()
        : null,
    isFeatured: v.isFeatured ?? false,
    isTrending: v.isTrending ?? false,
    isBreaking: v.isBreaking ?? false,
    manualPriority: v.manualPriority ? Number(v.manualPriority) : null,
    adsDisabled: v.adsDisabled ?? false,
    seoTitle: v.seoTitle || null,
    metaDescription: v.metaDescription || null,
    canonicalUrl: v.canonicalUrl || null,
    robotsIndex: v.robotsIndex ?? true,
    robotsFollow: v.robotsFollow ?? true,
  } satisfies Partial<Prisma.ArticleUncheckedCreateInput>;
}

function tagIdsFrom(formData: FormData): string[] {
  return formData.getAll("tags").map(String).filter(Boolean);
}

async function syncTags(articleId: string, tagIds: string[]) {
  await prisma.articleTag.deleteMany({ where: { articleId } });
  if (tagIds.length > 0) {
    await prisma.articleTag.createMany({
      data: tagIds.map((tagId) => ({ articleId, tagId })),
      skipDuplicates: true,
    });
  }
}

function friendlyDbError(e: unknown): string | null {
  if (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === "P2002"
  ) {
    return "That slug is already used by another article. Choose a different one.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Standard articles
// ---------------------------------------------------------------------------

export async function saveStandardArticle(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  await requireUser("AUTHOR");
  const parsed = standardSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;
  const id = String(formData.get("id") || "");
  const tagIds = tagIdsFrom(formData);
  const data = {
    ...commonData(v),
    type: "STANDARD" as const,
    content: v.content || null,
    readingTime: readingTimeMinutes(v.content ?? ""),
  };

  let articleId = id;
  try {
    if (id) {
      await prisma.article.update({ where: { id }, data });
      articleId = id;
    } else {
      const created = await prisma.article.create({ data });
      articleId = created.id;
    }
    await syncTags(articleId, tagIds);
  } catch (e) {
    const msg = friendlyDbError(e);
    if (msg) return { status: "error", message: msg };
    throw e;
  }

  revalidatePath("/admin/articles");
  revalidatePath(`/story/${v.slug}`);
  redirect(`/admin/articles/${articleId}/edit?saved=1` as Route);
}

// ---------------------------------------------------------------------------
// Listicles
// ---------------------------------------------------------------------------

export async function saveListicleArticle(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  await requireUser("AUTHOR");
  const parsed = listicleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;
  const id = String(formData.get("id") || "");
  const tagIds = tagIdsFrom(formData);

  const headings = formData.getAll("item_heading").map(String);
  const descriptions = formData.getAll("item_description").map(String);
  const mediaIds = formData.getAll("item_mediaId").map(String);
  const imageUrls = formData.getAll("item_imageUrl").map(String);
  const credits = formData.getAll("item_credit").map(String);
  const sourceUrls = formData.getAll("item_sourceUrl").map(String);

  const items = descriptions
    .map((description, i) => ({
      position: i + 1,
      heading: headings[i]?.trim() || null,
      description: description.trim(),
      // Prefer the uploaded Media row; fall back to a plain URL (legacy /
      // externally-hosted images) only when no media was pasted.
      mediaId: mediaIds[i]?.trim() || null,
      imageUrl: mediaIds[i]?.trim() ? null : imageUrls[i]?.trim() || null,
      credit: credits[i]?.trim() || null,
      sourceUrl: sourceUrls[i]?.trim() || null,
    }))
    .filter((it) => it.description.length > 0 || it.imageUrl || it.mediaId);

  if (items.length < 2) {
    return { status: "error", message: "Add at least 2 items to a Top N list." };
  }

  const data = {
    ...commonData(v),
    type: "LISTICLE" as const,
    intro: v.intro || null,
    listicleIndexSubpages: v.listicleIndexSubpages ?? true,
    readingTime: listicleReadingTimeMinutes(
      v.intro ?? "",
      items.map((i) => i.description),
    ),
  };

  let articleId = id;
  try {
    if (id) {
      await prisma.article.update({ where: { id }, data });
      await prisma.listicleItem.deleteMany({ where: { articleId: id } });
      articleId = id;
    } else {
      const created = await prisma.article.create({ data });
      articleId = created.id;
    }
    await prisma.listicleItem.createMany({
      data: items.map((it) => ({ ...it, articleId })),
    });
    await syncTags(articleId, tagIds);
  } catch (e) {
    const msg = friendlyDbError(e);
    if (msg) return { status: "error", message: msg };
    throw e;
  }

  revalidatePath("/admin/articles");
  revalidatePath(`/story/${v.slug}`);
  redirect(`/admin/articles/${articleId}/edit?saved=1` as Route);
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export async function deleteArticle(formData: FormData) {
  await requireUser("EDITOR");
  const id = String(formData.get("id"));
  await prisma.article.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/articles");
}
