import { prisma } from "@/lib/prisma";

export const quizService = {
  /** Lightweight existence check for the article view's "Test your knowledge" CTA. */
  async getSummaryForArticle(articleId: string) {
    const quiz = await prisma.quiz.findUnique({
      where: { articleId },
      select: { id: true, title: true, _count: { select: { questions: true } } },
    });
    if (!quiz || quiz._count.questions === 0) return null;
    return { id: quiz.id, title: quiz.title, questionCount: quiz._count.questions };
  },

  /** Full quiz (title + ordered questions) for the quiz-taking pages. */
  async getByArticleSlug(slug: string) {
    const quiz = await prisma.quiz.findFirst({
      where: { article: { slug } },
      select: {
        id: true,
        title: true,
        questions: { orderBy: { position: "asc" } },
      },
    });
    return quiz;
  },

  async getCodeStats(quizId: string) {
    const [total, used] = await Promise.all([
      prisma.quizCode.count({ where: { quizId } }),
      prisma.quizCode.count({ where: { quizId, isUsed: true } }),
    ]);
    return { total, used, available: total - used };
  },
};
