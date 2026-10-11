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
  role: z.string().trim().optional(),
  bio: z.string().trim().optional(),
  avatarUrl: z.string().trim().optional(),
  email: z.string().trim().optional(),
});

function parse(formData: FormData) {
  return schema.parse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    role: formData.get("role") || undefined,
    bio: formData.get("bio") || undefined,
    avatarUrl: formData.get("avatarUrl") || undefined,
    email: formData.get("email") || undefined,
  });
}

export async function createAuthor(formData: FormData) {
  await requireUser("EDITOR");
  await prisma.author.create({ data: parse(formData) });
  revalidatePath("/adminiyad/authors");
  redirect("/adminiyad/authors" as Route);
}

export async function updateAuthor(formData: FormData) {
  await requireUser("EDITOR");
  const id = String(formData.get("id"));
  await prisma.author.update({ where: { id }, data: parse(formData) });
  revalidatePath("/adminiyad/authors");
  redirect("/adminiyad/authors" as Route);
}

export async function deleteAuthor(formData: FormData) {
  await requireUser("EDITOR");
  const id = String(formData.get("id"));
  await prisma.article.updateMany({ where: { authorId: id }, data: { authorId: null } });
  await prisma.author.delete({ where: { id } });
  revalidatePath("/adminiyad/authors");
}
