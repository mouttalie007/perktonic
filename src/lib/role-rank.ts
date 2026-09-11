import type { Role } from "@prisma/client";

/** Client-safe role comparison (no server-only imports) — used by both the
 *  server auth guard and client nav filtering. */
const ROLE_RANK: Record<Role, number> = { AUTHOR: 0, EDITOR: 1, ADMIN: 2 };

export function hasRole(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}
