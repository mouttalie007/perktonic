"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-admin";

const schema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/),
  robotsIndex: z.coerce.boolean().optional(),
});

export async function createTag(formData: FormData) {
  await requireUser("EDITOR");
  const data = schema.parse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    robotsIndex: formData.get("robotsIndex") === "on",
  });
  await prisma.tag.create({ data });
  revalidatePath("/admin/tags");
  redirect("/admin/tags" as Route);
}

export async function updateTag(formData: FormData) {
  await requireUser("EDITOR");
  const id = String(formData.get("id"));
  const data = schema.parse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    robotsIndex: formData.get("robotsIndex") === "on",
  });
  await prisma.tag.update({ where: { id }, data });
  revalidatePath("/admin/tags");
  redirect("/admin/tags" as Route);
}

export async function deleteTag(formData: FormData) {
  await requireUser("EDITOR");
  const id = String(formData.get("id"));
  await prisma.tag.delete({ where: { id } });
  revalidatePath("/admin/tags");
}
