import "server-only";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getSessionUser, hasRole, type SessionUser } from "./auth";
import type { Role } from "@prisma/client";

/** Call at the top of an admin page/layout. Redirects to login if needed. */
export async function requireUser(minRole: Role = "AUTHOR"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login" as Route);
  if (!hasRole(user.role, minRole)) redirect("/admin" as Route);
  return user;
}
