"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-admin";
import { getSessionUser, hashPassword, verifyPassword, destroySession } from "@/lib/auth";

const createSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["ADMIN", "EDITOR", "AUTHOR"]),
  password: z.string().min(8, "At least 8 characters."),
});

export async function createUser(formData: FormData) {
  await requireUser("ADMIN");
  const v = createSchema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    password: formData.get("password"),
  });
  await prisma.user.create({
    data: { ...v, passwordHash: await hashPassword(v.password) },
  });
  revalidatePath("/admin/users");
  redirect("/admin/users" as Route);
}

export async function setUserActive(formData: FormData) {
  const me = await requireUser("ADMIN");
  const id = String(formData.get("id"));
  if (id === me.id) return; // can't deactivate yourself
  const isActive = formData.get("isActive") === "on";
  await prisma.user.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/users");
}

export async function deleteUser(formData: FormData) {
  const me = await requireUser("ADMIN");
  const id = String(formData.get("id"));
  if (id === me.id) return;
  await prisma.author.updateMany({ where: { userId: id }, data: { userId: null } });
  await prisma.user.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/users");
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, "At least 8 characters."),
    confirmPassword: z.string().min(1),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ChangePasswordState = { status: "idle" | "error" | "success"; message?: string };

export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const me = await getSessionUser();
  if (!me) return { status: "error", message: "Not signed in." };

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const user = await prisma.user.findUnique({ where: { id: me.id } });
  if (!user || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return { status: "error", message: "Current password is incorrect." };
  }

  await prisma.user.update({
    where: { id: me.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });
  // Invalidate this session so the new password takes effect on next login.
  await destroySession();
  redirect("/admin/login" as Route);
}
