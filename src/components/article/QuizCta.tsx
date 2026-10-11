import Link from "next/link";
import type { Route } from "next";

export function QuizCta({
  slug,
  quiz,
}: {
  slug: string;
  quiz: { title: string; questionCount: number } | null;
}) {
  if (!quiz) return null;

  return (
    <div className="border-brand bg-ink-deep mt-10 rounded-md border-2 p-6 text-center text-white sm:p-8">
      <p className="text-brand text-xs font-bold tracking-[0.2em] uppercase">Quiz</p>
      <h3 className="mt-2 text-xl font-extrabold sm:text-2xl">{quiz.title}</h3>
      <p className="mt-2 text-sm text-white/70">
        {quiz.questionCount} quick questions — think you know this one?
      </p>
      <Link
        href={`/story/${slug}/quiz/q1` as Route}
        className="bg-brand text-ink hover:bg-brand-strong mt-5 inline-block rounded-sm px-8 py-3 text-sm font-bold transition-colors"
      >
        Test Your Knowledge →
      </Link>
    </div>
  );
}
