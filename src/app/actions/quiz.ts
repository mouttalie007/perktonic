"use server";

import { prisma } from "@/lib/prisma";

export type ClaimCodeResult =
  | { ok: true; code: string }
  | { ok: false; reason: "no-quiz" | "exhausted" };

/**
 * Atomically claims one unused code for the article's quiz (FOR UPDATE SKIP
 * LOCKED so two simultaneous visitors can never be handed the same code).
 * Public action -- no auth, called by any visitor who finishes the quiz.
 */
export async function claimQuizCodeAction(articleSlug: string): Promise<ClaimCodeResult> {
  const rows = await prisma.$queryRaw<{ code: string }[]>`
    UPDATE "quiz_codes"
    SET "isUsed" = true, "usedAt" = now()
    WHERE id = (
      SELECT qc.id
      FROM "quiz_codes" qc
      JOIN "quizzes" q ON q.id = qc."quizId"
      JOIN "articles" a ON a.id = q."articleId"
      WHERE a.slug = ${articleSlug} AND qc."isUsed" = false
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING code;
  `;

  const row = rows[0];
  if (!row) {
    const hasQuiz = await prisma.quiz.findFirst({
      where: { article: { slug: articleSlug } },
      select: { id: true },
    });
    return { ok: false, reason: hasQuiz ? "exhausted" : "no-quiz" };
  }

  return { ok: true, code: row.code };
}
