import { prisma } from "@/lib/prisma";
import type { CommentStatus } from "@prisma/client";
import { subpagePath, allViewPath } from "@/lib/listicle";

/**
 * Flat public comments (homepage redesign, 2026-09-12). Default PENDING —
 * see the schema comment on Comment for the moderation posture.
 */

export const commentService = {
  /** Approved comments for one article, newest first. */
  async listApproved(articleId: string, limit = 50) {
    return prisma.comment.findMany({
      where: { articleId, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, name: true, body: true, createdAt: true },
    });
  },

  /** Approved comment count for a single article. */
  async countApproved(articleId: string): Promise<number> {
    return prisma.comment.count({ where: { articleId, status: "APPROVED" } });
  },

  /** Batch approved counts for many articles at once (feed rows). */
  async countApprovedForArticles(
    articleIds: string[],
  ): Promise<Map<string, number>> {
    if (articleIds.length === 0) return new Map();
    const rows = await prisma.comment.groupBy({
      by: ["articleId"],
      where: { articleId: { in: articleIds }, status: "APPROVED" },
      _count: { _all: true },
    });
    return new Map(rows.map((r) => [r.articleId, r._count._all]));
  },

  async create(data: { articleId: string; name: string; body: string; ipHash: string | null }) {
    return prisma.comment.create({ data });
  },

  /** Admin moderation queue (spec-alike ContactMessage pattern). */
  async listForModeration(status?: CommentStatus) {
    return prisma.comment.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { article: { select: { title: true, slug: true } } },
    });
  },

  async setStatus(id: string, status: CommentStatus) {
    return prisma.comment.update({ where: { id }, data: { status } });
  },

  async remove(id: string) {
    return prisma.comment.delete({ where: { id } }).catch(() => null);
  },

  /**
   * The public page path(s) that render this comment's article, so a
   * moderation action can revalidate the (statically generated) page it
   * actually shows up on. Comments only render on a listicle's last item
   * and its /all view (see ListicleView/ListicleAllView) — both need
   * revalidating, since either could be the page a reader lands on.
   */
  async publicPathsFor(commentId: string): Promise<string[]> {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        article: {
          select: {
            slug: true,
            type: true,
            _count: { select: { listicleItems: true } },
          },
        },
      },
    });
    if (!comment) return [];
    const { slug, type, _count } = comment.article;
    if (type === "STANDARD") return [subpagePath(slug, 1)];
    const lastPosition = Math.max(1, _count.listicleItems);
    return [subpagePath(slug, lastPosition), allViewPath(slug)];
  },
};
