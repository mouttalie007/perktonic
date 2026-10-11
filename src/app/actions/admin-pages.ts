"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-admin";

const schema = z.object({
  title: z.string().trim().min(1),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/),
  content: z.string().optional(),
  seoTitle: z.string().trim().optional(),
  metaDescription: z.string().trim().optional(),
  robotsIndex: z.coerce.boolean().optional(),
  showInFooter: z.coerce.boolean().optional(),
  footerColumn: z.string().trim().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
});

function parse(formData: FormData) {
  return schema.parse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    content: formData.get("content") || "",
    seoTitle: formData.get("seoTitle") || undefined,
    metaDescription: formData.get("metaDescription") || undefined,
    robotsIndex: formData.get("robotsIndex") === "on",
    showInFooter: formData.get("showInFooter") === "on",
    footerColumn: formData.get("footerColumn") || undefined,
    status: formData.get("status"),
  });
}

export async function createPage(formData: FormData) {
  await requireUser("EDITOR");
  await prisma.page.create({ data: parse(formData) });
  revalidatePath("/adminiyad/pages");
  redirect("/adminiyad/pages" as Route);
}

export async function updatePage(formData: FormData) {
  await requireUser("EDITOR");
  const id = String(formData.get("id"));
  await prisma.page.update({ where: { id }, data: parse(formData) });
  revalidatePath("/adminiyad/pages");
  redirect("/adminiyad/pages" as Route);
}

export async function deletePage(formData: FormData) {
  await requireUser("EDITOR");
  const id = String(formData.get("id"));
  await prisma.page.delete({ where: { id } });
  revalidatePath("/adminiyad/pages");
}
