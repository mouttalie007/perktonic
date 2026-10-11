"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-admin";
import { applyDemoEngagementToAllMissing, clearAllDemoEngagement } from "@/lib/demo-engagement";

export async function saveDemoCommentPool(formData: FormData) {
  await requireUser("ADMIN");
  const pool = String(formData.get("demoCommentPool") || "");
  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    update: { demoCommentPool: pool },
    create: { id: "singleton", demoCommentPool: pool },
  });
  revalidatePath("/adminiyad/settings/demo-engagement");
}

export async function applyDemoEngagementNow() {
  await requireUser("ADMIN");
  const count = await applyDemoEngagementToAllMissing();
  revalidatePath("/adminiyad/settings/demo-engagement");
  return { count };
}

export async function clearDemoEngagementNow() {
  await requireUser("ADMIN");
  const result = await clearAllDemoEngagement();
  revalidatePath("/adminiyad/settings/demo-engagement");
  return result;
}
