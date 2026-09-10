import { prisma } from "@/lib/prisma";
import { serverEnv } from "@/config/env.server";

/**
 * Media resolution + upload abstraction (spec §15, §42, §68).
 * Phase 0: read helpers + URL resolution only. Actual upload handling
 * (local disk / Cloudflare R2 / Cloudinary) is wired in Phase 7.
 */

export const mediaService = {
  /** Turn a stored key/url into a delivery URL for the active provider. */
  resolveUrl(input: { url?: string | null; storageKey?: string | null }): string {
    if (input.url && /^https?:\/\//.test(input.url)) return input.url;
    if (input.url && input.url.startsWith("/")) return input.url;
    const base = serverEnv.MEDIA_PUBLIC_BASE_URL.replace(/\/$/, "");
    const key = (input.storageKey ?? input.url ?? "").replace(/^\//, "");
    return `${base}/${key}`;
  },

  async getById(id: string) {
    return prisma.media.findUnique({ where: { id } });
  },

  async list({ page = 1, pageSize = 40 } = {}) {
    const [items, total] = await Promise.all([
      prisma.media.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.media.count(),
    ]);
    return { items, total, page, pageSize };
  },
};
