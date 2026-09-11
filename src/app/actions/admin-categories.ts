"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-admin";

const schema = z.object({
  name: z.string().trim().min(1),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
  description: z.string().trim().optional(),
  shortDescription: z.string().trim().optional(),
  imageUrl: z.string().trim().optional(),
  iconKey: z.string().trim().optional(),
  seoTitle: z.string().trim().optional(),
  metaDescription: z.string().trim().optional(),
  robotsIndex: z.coerce.boolean().optional(),
  order: z.coerce.number().int().optional(),
});

function parse(formData: FormData) {
  return schema.parse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || undefined,
    shortDescription: formData.get("shortDescription") || undefined,
    imageUrl: formData.get("imageUrl") || undefined,
    iconKey: formData.get("iconKey") || undefined,
    seoTitle: formData.get("seoTitle") || undefined,
    metaDescription: formData.get("metaDescription") || undefined,
    robotsIndex: formData.get("robotsIndex") === "on",
    order: formData.get("order") || 0,
  });
}

export async function createCategory(formData: FormData) {
  await requireUser("EDITOR");
  const data = parse(formData);
  await prisma.category.create({ data });
  revalidatePath("/admin/categories");
  redirect("/admin/categories" as Route);
}

export async function updateCategory(formData: FormData) {
  await requireUser("EDITOR");
  const id = String(formData.get("id"));
  const data = parse(formData);
  await prisma.category.update({ where: { id }, data });
  revalidatePath("/admin/categories");
  redirect("/admin/categories" as Route);
}

export async function deleteCategory(formData: FormData) {
  await requireUser("EDITOR");
  const id = String(formData.get("id"));
  await prisma.article.updateMany({
    where: { categoryId: id },
    data: { categoryId: null },
  });
  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin/categories");
}
