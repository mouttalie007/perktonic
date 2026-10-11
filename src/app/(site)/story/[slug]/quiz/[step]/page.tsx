import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { articleService } from "@/services/article.service";
import { quizService } from "@/services/quiz.service";
import { seoService } from "@/services/seo.service";
import { QuizQuestionCard } from "@/components/quiz/QuizQuestionCard";

type Params = { params: Promise<{ slug: string; step: string }> };

const STEP_RE = /^q(\d{1,2})$/;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, step } = await params;
  const match = STEP_RE.exec(step);
  if (!match) return { title: "Quiz" };

  const quiz = await quizService.getByArticleSlug(slug);
  const n = Number(match[1]);
  if (!quiz || n < 1 || n > quiz.questions.length) return { title: "Quiz" };

  return seoService.buildMetadata({
    title: `${quiz.title} — Question ${n} of ${quiz.questions.length}`,
    path: `/story/${slug}/quiz/${step}`,
    type: "website",
    // Thin, near-duplicate per-question pages -- keep out of the index.
    robotsIndex: false,
  });
}

export default async function QuizStepPage({ params }: Params) {
  const { slug, step } = await params;

  const match = STEP_RE.exec(step);
  if (!match) notFound();
  const position = Number(match[1]);

  const [article, quiz] = await Promise.all([
    articleService.getForRender(slug),
    quizService.getByArticleSlug(slug),
  ]);
  if (!article || !quiz) notFound();
  if (position < 1 || position > quiz.questions.length) notFound();

  const question = quiz.questions[position - 1];

  return (
    <QuizQuestionCard
      slug={slug}
      articleTitle={article.title}
      quizTitle={quiz.title}
      question={question.question}
      options={question.options}
      position={position}
      total={quiz.questions.length}
    />
  );
}
