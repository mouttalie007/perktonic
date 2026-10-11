"use client";

import { useState, useTransition } from "react";
import { saveQuizAction, generateQuizCodesAction, deleteQuizAction } from "@/app/actions/admin-quiz";
import { buildQuizPrompt } from "@/lib/quiz-prompt";
import { Card, Textarea, Button } from "../ui";

interface ExistingQuestion {
  position: number;
  question: string;
  options: string[];
}

interface Props {
  articleId: string;
  articleSlug: string;
  initialQuiz: { id: string; title: string; questions: ExistingQuestion[] } | null;
  initialCodeStats: { total: number; used: number; available: number } | null;
}

const PLACEHOLDER = `Title: How Well Do You Know This Topic?

1. First question here?
A) First option
B) Second option
C) Third option

2. Second question here?
A) First option
B) Second option
C) Third option

(... continue through question 10)`;

function toPasteFormat(quiz: { title: string; questions: ExistingQuestion[] }): string {
  const blocks = quiz.questions
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((q, i) => {
      const letters = ["A", "B", "C"];
      const opts = q.options.map((o, j) => `${letters[j]}) ${o}`).join("\n");
      return `${i + 1}. ${q.question}\n${opts}`;
    });
  return `Title: ${quiz.title}\n\n${blocks.join("\n\n")}`;
}

export function QuizBox({ articleId, articleSlug, initialQuiz, initialCodeStats }: Props) {
  const [raw, setRaw] = useState(() => (initialQuiz ? toPasteFormat(initialQuiz) : ""));
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [quizId, setQuizId] = useState<string | null>(initialQuiz?.id ?? null);
  const [codeStats, setCodeStats] = useState(initialCodeStats);
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [promptCopied, setPromptCopied] = useState(false);
  const [saving, startSaving] = useTransition();
  const [generating, startGenerating] = useTransition();
  const [deleting, startDeleting] = useTransition();

  function copyPrompt() {
    const articleUrl = `${window.location.origin}/story/${articleSlug}`;
    navigator.clipboard.writeText(buildQuizPrompt(articleUrl)).then(() => {
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    });
  }

  function handleSave() {
    startSaving(async () => {
      const res = await saveQuizAction(articleId, raw);
      if (res.ok) {
        setSaveMsg({ ok: true, text: `Saved "${res.title}" — ${res.questionCount} questions.` });
        setQuizId(res.quizId);
        setCodeStats((prev) => prev ?? { total: 0, used: 0, available: 0 });
      } else {
        setSaveMsg({ ok: false, text: res.error });
      }
    });
  }

  function handleDelete() {
    if (!window.confirm("Remove this quiz and all its codes? This can't be undone.")) return;
    startDeleting(async () => {
      await deleteQuizAction(articleId);
      setQuizId(null);
      setCodeStats(null);
      setNewCodes([]);
      setRaw("");
      setSaveMsg(null);
    });
  }

  function handleGenerateCodes() {
    if (!quizId) return;
    startGenerating(async () => {
      const res = await generateQuizCodesAction(quizId, articleId);
      if (res.ok) {
        setNewCodes((prev) => [...res.codes, ...prev]);
        setCodeStats((prev) =>
          prev
            ? { ...prev, total: prev.total + 10, available: prev.available + 10 }
            : { total: 10, used: 0, available: 10 },
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="mb-1 text-base font-bold">Quiz</h3>
        <p className="text-muted mb-3 text-sm">
          Paste a title and exactly 10 numbered questions, each with 3 options (A, B, C). Shown as a
          &quot;Test your knowledge&quot; button at the bottom of the article.
        </p>

        <div className="border-line bg-surface mb-4 rounded-sm border p-3">
          <p className="text-muted mb-2 text-xs">
            Copies a ChatGPT prompt that already includes this article&apos;s live link — paste ChatGPT&apos;s
            reply straight into the box below.
          </p>
          <Button type="button" variant="secondary" onClick={copyPrompt}>
            {promptCopied ? "Copied!" : "Copy prompt"}
          </Button>
        </div>

        <Textarea
          rows={14}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={PLACEHOLDER}
          className="font-mono text-xs"
        />
        <div className="mt-3 flex items-center gap-3">
          <Button type="button" onClick={handleSave} disabled={saving || !raw.trim()}>
            {saving ? "Saving…" : initialQuiz ? "Update quiz" : "Save quiz"}
          </Button>
          {quizId && (
            <Button type="button" variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Removing…" : "Remove quiz"}
            </Button>
          )}
        </div>
        {saveMsg && (
          <p className={`mt-2 text-sm ${saveMsg.ok ? "text-muted" : "text-accent-red"}`}>{saveMsg.text}</p>
        )}
      </Card>

      {quizId && (
        <Card>
          <h3 className="mb-1 text-base font-bold">Quiz codes</h3>
          <p className="text-muted mb-3 text-sm">
            Visitors who finish the quiz and share get one of these codes. Generate more any time — existing
            codes are never replaced.
          </p>
          {codeStats && (
            <p className="mb-3 text-sm">
              <strong>{codeStats.available}</strong> available · <strong>{codeStats.used}</strong> claimed ·{" "}
              <strong>{codeStats.total}</strong> total
            </p>
          )}
          <Button type="button" onClick={handleGenerateCodes} disabled={generating}>
            {generating ? "Generating…" : "Generate 10 more codes"}
          </Button>
          {newCodes.length > 0 && (
            <div className="border-line mt-3 grid grid-cols-5 gap-2 rounded-sm border p-3 font-mono text-sm">
              {newCodes.map((c) => (
                <span key={c} className="bg-surface rounded-sm px-2 py-1 text-center">
                  {c}
                </span>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
