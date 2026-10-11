"use server";

import { z } from "zod";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  createSession,
  destroySession,
  isLoginRateLimited,
  recordLoginAttempt,
  clearLoginAttempts,
} from "@/lib/auth";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export type LoginState = { status: "idle" | "error"; message?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email and password." };
  }
  const { email, password } = parsed.data;

  if (isLoginRateLimited(email)) {
    return {
      status: "error",
      message: "Too many attempts. Try again in a few minutes.",
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user && (await verifyPassword(password, user.passwordHash));

  if (!ok || !user.isActive) {
    recordLoginAttempt(email);
    return { status: "error", message: "Incorrect email or password." };
  }

  clearLoginAttempts(email);
  await createSession(user.id);
  redirect("/adminiyad" as Route);
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/adminiyad/login" as Route);
}
