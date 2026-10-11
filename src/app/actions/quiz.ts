"use server";

import { prisma } from "@/lib/prisma";
import { generateQuizCode } from "@/lib/quiz-codes";

export type ClaimCodeResult = { ok: true; code: string } | { ok: false; reason: "no-quiz" };

/**
 * Mints a brand-new, globally unique code the moment a visitor finishes a
 * quiz and shares the article -- there is no pre-generated pool. Retries on
 * the astronomically rare random collision against the unique constraint.
 * Public action -- no auth, called by any visitor.
 */
export async function claimQuizCodeAction(articleSlug: string): Promise<ClaimCodeResult> {
  const quiz = await prisma.quiz.findFirst({
    where: { article: { slug: articleSlug } },
    select: { id: true },
  });
  if (!quiz) return { ok: false, reason: "no-quiz" };

  for (;;) {
    const candidate = generateQuizCode();
    try {
      await prisma.quizCode.create({ data: { quizId: quiz.id, code: candidate } });
      return { ok: true, code: candidate };
    } catch {
      // Unique constraint hit -- vanishingly rare, just try another code.
    }
  }
}
