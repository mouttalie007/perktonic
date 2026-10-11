"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CompletionModal } from "./CompletionModal";

const LETTERS = ["A", "B", "C"];

export function QuizQuestionCard({
  slug,
  articleTitle,
  quizTitle,
  question,
  options,
  position,
  total,
}: {
  slug: string;
  articleTitle: string;
  quizTitle: string;
  question: string;
  options: string[];
  position: number;
  total: number;
}) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const isLast = position === total;

  function handleSelect() {
    if (isLast) {
      setShowModal(true);
    } else {
      router.push(`/story/${slug}/quiz/q${position + 1}`);
    }
  }

  return (
    <div className="site-container flex min-h-[65vh] items-center justify-center py-10">
      <div
        key={position}
        className="animate-slide-down border-line bg-canvas w-full max-w-xl rounded-xl border p-6 shadow-sm sm:p-10"
      >
        <p className="text-brand-ink text-xs font-bold tracking-[0.2em] uppercase">{quizTitle}</p>

        <div className="bg-surface mt-4 mb-2 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="bg-brand h-full rounded-full transition-all duration-500"
            style={{ width: `${(position / total) * 100}%` }}
          />
        </div>
        <p className="text-muted mb-6 text-sm font-semibold">
          Question {position} of {total}
        </p>

        <h1 className="mb-8 text-xl leading-snug font-extrabold sm:text-2xl">{question}</h1>

        <div className="space-y-3">
          {options.map((opt, i) => (
            <button
              key={i}
              type="button"
              onClick={handleSelect}
              className="border-line hover:border-brand hover:bg-surface group flex w-full items-center gap-4 rounded-lg border-2 px-5 py-4 text-left transition-colors"
            >
              <span className="bg-ink group-hover:bg-brand group-hover:text-ink flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white transition-colors">
                {LETTERS[i]}
              </span>
              <span className="font-semibold">{opt}</span>
            </button>
          ))}
        </div>
      </div>

      {showModal && (
        <CompletionModal slug={slug} articleTitle={articleTitle} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
