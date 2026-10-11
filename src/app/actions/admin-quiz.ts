"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-admin";
import { parseQuizPaste } from "@/lib/quiz-parse";

export type SaveQuizResult =
  | { ok: true; quizId: string; title: string; questionCount: number }
  | { ok: false; error: string };

/** Replaces the article's quiz (title + all 10 questions) from pasted text. */
export async function saveQuizAction(articleId: string, raw: string): Promise<SaveQuizResult> {
  await requireUser("EDITOR");

  const parsed = parseQuizPaste(raw);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const article = await prisma.article.findUnique({ where: { id: articleId }, select: { id: true, slug: true } });
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
  revalidatePath(`/story/${article.slug}`);
  return { ok: true, quizId, title: parsed.title, questionCount: parsed.questions.length };
}

export async function deleteQuizAction(articleId: string): Promise<void> {
  await requireUser("EDITOR");
  const article = await prisma.article.findUnique({ where: { id: articleId }, select: { slug: true } });
  await prisma.quiz.deleteMany({ where: { articleId } });
  revalidatePath(`/adminiyad/articles/${articleId}/edit`);
  if (article) revalidatePath(`/story/${article.slug}`);
}
