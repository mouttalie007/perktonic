"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-admin";
import { parseQuizPaste } from "@/lib/quiz-parse";
import { generateQuizCode } from "@/lib/quiz-codes";

export type SaveQuizResult =
  | { ok: true; quizId: string; title: string; questionCount: number }
  | { ok: false; error: string };

/** Replaces the article's quiz (title + all 10 questions) from pasted text. */
export async function saveQuizAction(articleId: string, raw: string): Promise<SaveQuizResult> {
  await requireUser("EDITOR");

  const parsed = parseQuizPaste(raw);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const article = await prisma.article.findUnique({ where: { id: articleId }, select: { id: true } });
  if (!article) return { ok: false, error: "Article not found." };

  const quizId = await prisma.$transaction(async (tx) => {
    const quiz = await tx.quiz.upsert({
      where: { articleId },
      update: { title: parsed.title },
      create: { articleId, title: parsed.title },
    });
    await tx.quizQuestion.deleteMany({ where: { quizId: quiz.id } });
    await tx.quizQuestion.createMany({
      data: parsed.questions.map((q) => ({
        quizId: quiz.id,
        position: q.position,
        question: q.question,
        options: q.options,
      })),
    });
    return quiz.id;
  });

  revalidatePath(`/adminiyad/articles/${articleId}/edit`);
  return { ok: true, quizId, title: parsed.title, questionCount: parsed.questions.length };
}

export async function deleteQuizAction(articleId: string): Promise<void> {
  await requireUser("EDITOR");
  await prisma.quiz.deleteMany({ where: { articleId } });
  revalidatePath(`/adminiyad/articles/${articleId}/edit`);
}

export type GenerateCodesResult = { ok: true; codes: string[] } | { ok: false; error: string };

/** Tops the code pool up by 10 (never replaces existing codes). */
export async function generateQuizCodesAction(
  quizId: string,
  articleId: string,
): Promise<GenerateCodesResult> {
  await requireUser("EDITOR");

  const codes: string[] = [];
  // Retries on the rare random collision rather than failing the batch.
  while (codes.length < 10) {
    const candidate = generateQuizCode();
    try {
      await prisma.quizCode.create({ data: { quizId, code: candidate } });
      codes.push(candidate);
    } catch {
      // Unique constraint hit -- try another random code.
    }
  }

  revalidatePath(`/adminiyad/articles/${articleId}/edit`);
  return { ok: true, codes };
}
