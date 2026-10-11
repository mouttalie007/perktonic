"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-admin";

export async function setContactMessageStatus(formData: FormData) {
  await requireUser("EDITOR");
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  await prisma.contactMessage.update({ where: { id }, data: { status } });
  revalidatePath("/adminiyad/contact-messages");
}

export async function deleteContactMessage(formData: FormData) {
  await requireUser("EDITOR");
  const id = String(formData.get("id"));
  await prisma.contactMessage.delete({ where: { id } }).catch(() => {});
  revalidatePath("/adminiyad/contact-messages");
}
