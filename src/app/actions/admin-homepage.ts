"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-admin";

export async function setFeatured(formData: FormData) {
  await requireUser("EDITOR");
  const id = String(formData.get("id"));
  const isFeatured = formData.get("isFeatured") === "on";
  const priorityRaw = String(formData.get("manualPriority") || "");
  await prisma.article.update({
    where: { id },
    data: {
      isFeatured,
      manualPriority: priorityRaw ? Number(priorityRaw) : null,
    },
  });
  revalidatePath("/adminiyad/homepage");
  revalidatePath("/");
}
