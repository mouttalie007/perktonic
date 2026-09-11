"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-admin";

const schema = z.object({
  fromPath: z.string().trim().min(1).startsWith("/", "Must start with /"),
  toPath: z.string().trim().min(1),
  statusCode: z.coerce.number().int().refine((n) => [301, 302, 307, 308].includes(n)),
  enabled: z.coerce.boolean().optional(),
});

export async function createRedirect(formData: FormData) {
  await requireUser("ADMIN");
  const data = schema.parse({
    fromPath: formData.get("fromPath"),
    toPath: formData.get("toPath"),
    statusCode: formData.get("statusCode") || 301,
    enabled: formData.get("enabled") === "on",
  });
  await prisma.redirect.create({ data });
  revalidatePath("/admin/redirects");
}

export async function toggleRedirect(formData: FormData) {
  await requireUser("ADMIN");
  const id = String(formData.get("id"));
  const enabled = formData.get("enabled") === "on";
  await prisma.redirect.update({ where: { id }, data: { enabled } });
  revalidatePath("/admin/redirects");
}

export async function deleteRedirect(formData: FormData) {
  await requireUser("ADMIN");
  const id = String(formData.get("id"));
  await prisma.redirect.delete({ where: { id } });
  revalidatePath("/admin/redirects");
}
