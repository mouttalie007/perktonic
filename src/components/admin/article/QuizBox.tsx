"use client";

import { useState, useTransition } from "react";
import { saveQuizAction, deleteQuizAction } from "@/app/actions/admin-quiz";
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

export function QuizBox({ articleId, articleSlug, initialQuiz }: Props) {
  const [raw, setRaw] = useState(() => (initialQuiz ? toPasteFormat(initialQuiz) : ""));
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [hasQuiz, setHasQuiz] = useState(Boolean(initialQuiz));
  const [promptCopied, setPromptCopied] = useState(false);
  const [saving, startSaving] = useTransition();
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
        setHasQuiz(true);
      } else {
        setSaveMsg({ ok: false, text: res.error });
      }
    });
  }

  function handleDelete() {
    if (!window.confirm("Remove this quiz? This can't be undone.")) return;
    startDeleting(async () => {
      await deleteQuizAction(articleId);
      setHasQuiz(false);
      setRaw("");
      setSaveMsg(null);
    });
  }

  return (
    <Card>
      <h3 className="mb-1 text-base font-bold">Quiz</h3>
      <p className="text-muted mb-3 text-sm">
        Paste a title and exactly 10 numbered questions, each with 3 options (A, B, C). Shown as a
        &quot;Test your knowledge&quot; button at the bottom of the article. Each visitor who finishes gets
        their own unique code, minted automatically — nothing to generate here.
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
          {saving ? "Saving…" : hasQuiz ? "Update quiz" : "Save quiz"}
        </Button>
        {hasQuiz && (
          <Button type="button" variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Removing…" : "Remove quiz"}
          </Button>
        )}
      </div>
      {saveMsg && (
        <p className={`mt-2 text-sm ${saveMsg.ok ? "text-muted" : "text-accent-red"}`}>{saveMsg.text}</p>
      )}
    </Card>
  );
}
