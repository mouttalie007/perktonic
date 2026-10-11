"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-admin";

export async function setTrending(formData: FormData) {
  await requireUser("EDITOR");
  const id = String(formData.get("id"));
  const isTrending = formData.get("isTrending") === "on";
  const priorityRaw = String(formData.get("manualPriority") || "");
  await prisma.article.update({
    where: { id },
    data: {
      isTrending,
      manualPriority: priorityRaw ? Number(priorityRaw) : null,
    },
  });
  revalidatePath("/adminiyad/trending");
  revalidatePath("/");
}
