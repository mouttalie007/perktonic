import "server-only";
import { cookies } from "next/headers";
import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Role } from "@prisma/client";
import { createRateLimiter } from "./rate-limit";
export { hasRole } from "./role-rank";

/**
 * Admin authentication (Phase 7, spec §57). Server-side, revocable sessions:
 * the cookie holds a random opaque token; only its SHA-256 hash is stored, so
 * a database leak alone never yields a usable session.
 */

export const SESSION_COOKIE = "vt_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  store.delete(SESSION_COOKIE);
  if (!token) return;
  await prisma.session
    .delete({ where: { tokenHash: hashToken(token) } })
    .catch(() => {});
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/** Reads + validates the session cookie. Never throws. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) {
    return null;
  }
  const { user } = session;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** Brute-force guard for the login form (spec §57, §88). */
const loginLimiter = createRateLimiter(8, 15 * 60_000);
export const isLoginRateLimited = loginLimiter.isLimited;
export const recordLoginAttempt = loginLimiter.record;
export const clearLoginAttempts = loginLimiter.clear;
