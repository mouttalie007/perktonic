"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  getChatPromptAction,
  importPastedArticleAction,
  saveBriefQuizAction,
} from "@/app/actions/admin-ai-articles";
import type { BriefView } from "@/lib/ai-article/views";
import { buildQuizPrompt } from "@/lib/quiz-prompt";
import { Button, Textarea } from "../ui";

function Shell({
  label,
  title,
  onClose,
  children,
}: {
  label: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="bg-canvas flex max-h-[92vh] w-full max-w-2xl flex-col rounded-xl shadow-xl">
        <div className="border-line flex items-start justify-between gap-4 border-b px-6 py-4">
          <div className="min-w-0">
            <p className="text-muted text-xs font-bold tracking-wide uppercase">
              {label}
            </p>
            <h2 className="truncate text-base font-extrabold">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-ink -mt-1 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="bg-ink mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white">
      {n}
    </span>
  );
}

function useCopied() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => void (timer.current && clearTimeout(timer.current)),
    [],
  );
  async function copy(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2200);
      return true;
    } catch {
      return false;
    }
  }
  return { copied, copy };
}

/** Button 1: the article prompt for claude.ai, and the box to paste Claude's reply into. */
export function ArticleDialog({
  brief,
  notes,
  onClose,
  onSaved,
}: {
  brief: BriefView;
  notes: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    title: string;
    warnings: string[];
  } | null>(null);
  const { copied, copy } = useCopied();
  const hasDraft = brief.status === "DRAFTED";

  // Loaded when the popup opens, so "Copy" is a single instant click.
  useEffect(() => {
    let cancelled = false;
    getChatPromptAction(brief.id, brief.first ? notes : undefined)
      .then((p) => !cancelled && (p ? setPrompt(p) : setLoadError(true)))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief.id]);

  async function save() {
    if (
      hasDraft &&
      !window.confirm(
        "This article already has a draft. Saving replaces it, and any images already pasted into it are lost. Continue?",
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await importPastedArticleAction(brief.id, reply);
      if (res.ok) {
        setDone({ title: res.title, warnings: res.warnings });
        onSaved();
      } else {
        setError(res.error);
      }
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell label="1 · Article" title={brief.title} onClose={onClose}>
      {done ? (
        <div>
          <h3 className="text-lg font-extrabold">Draft saved ✓</h3>
          <p className="text-muted mt-1 text-sm">{done.title}</p>
          {done.warnings.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 rounded-sm bg-amber-50 p-3 pl-6 text-xs text-amber-900">
              {done.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-sm">
            Next: close this and press <strong>2 · Images</strong> on the
            article.
          </p>
          <div className="mt-4">
            <Button type="button" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-bold">
              <StepNumber n={1} />
              Copy the prompt and send it to Claude
            </p>
            <p className="text-muted mb-3 text-xs">
              In claude.ai open a <strong>new chat</strong>, pick the strongest
              model, turn on <strong>Extended thinking</strong> and{" "}
              <strong>Web search</strong>, then paste the prompt and send it.
              Claude researches, then answers with the whole article in one code
              box.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={async () => {
                  if (prompt && !(await copy(prompt)))
                    setError(
                      "The browser blocked copying. Allow clipboard access and try again.",
                    );
                }}
                disabled={!prompt}
              >
                {copied
                  ? "Copied ✓"
                  : prompt
                    ? "Copy prompt"
                    : loadError
                      ? "Couldn't load"
                      : "Preparing…"}
              </Button>
              {prompt && (
                <span className="text-muted text-xs">
                  {prompt.length.toLocaleString()} characters
                </span>
              )}
            </div>
            {brief.first && !notes.trim() && (
              <p className="mt-2 rounded-sm bg-amber-50 p-2 text-xs text-amber-900">
                This article is meant to use your real first-hand notes (box on
                the card). With no notes, Claude writes an honest research-based
                version instead.
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-bold">
              <StepNumber n={2} />
              Paste Claude&apos;s reply here
            </p>
            <p className="text-muted mb-2 text-xs">
              Click &ldquo;Copy&rdquo; on Claude&apos;s code box, then paste
              here (Ctrl+V). The code-box markers are handled automatically.
            </p>
            <Textarea
              rows={10}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Title: …"
              className="font-mono text-xs"
            />
            {error && (
              <p
                role="alert"
                className="bg-accent-red/10 text-accent-red mt-3 rounded-sm p-2.5 text-sm font-semibold"
              >
                {error}
              </p>
            )}
            <div className="mt-3 flex items-center gap-3">
              <Button
                type="button"
                onClick={save}
                disabled={busy || !reply.trim()}
              >
                {busy
                  ? "Saving…"
                  : hasDraft
                    ? "Replace the draft"
                    : "Save as draft"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

/** Button 3 (after publishing): the quiz prompt with the live link, and the box to paste the quiz into. */
export function QuizDialog({
  brief,
  onClose,
  onSaved,
}: {
  brief: BriefView;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { copied, copy } = useCopied();
  const liveUrl = `${typeof window === "undefined" ? "" : window.location.origin}/story/${brief.slug}`;

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await saveBriefQuizAction(brief.id, reply);
      if (res.ok) {
        setMsg({
          ok: true,
          text: `Saved “${res.title}” — ${res.questionCount} questions. The quiz button is now live on the article.`,
        });
        onSaved();
      } else {
        setMsg({ ok: false, text: res.error });
      }
    } catch {
      setMsg({
        ok: false,
        text: "Couldn't save. Check your connection and try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell label="3 · Quiz" title={brief.title} onClose={onClose}>
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-bold">
            <StepNumber n={1} />
            Copy the quiz prompt (it contains the live article link)
          </p>
          <p className="text-muted mb-3 text-xs">
            Paste it into a chat where Claude can open web pages. Link:{" "}
            <span className="font-semibold">{liveUrl}</span>
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              if (!(await copy(buildQuizPrompt(liveUrl))))
                setMsg({
                  ok: false,
                  text: "The browser blocked copying. Allow clipboard access and try again.",
                });
            }}
          >
            {copied ? "Copied ✓" : "Copy quiz prompt"}
          </Button>
          {brief.hasQuiz && (
            <p className="mt-2 text-xs font-semibold text-green-800">
              This article already has a quiz. Saving a new one replaces it.
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-bold">
            <StepNumber n={2} />
            Paste the quiz here
          </p>
          <Textarea
            rows={12}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={"Title: …\n\n1. Question?\nA) …\nB) …\nC) …"}
            className="font-mono text-xs"
          />
          {msg && (
            <p
              role={msg.ok ? "status" : "alert"}
              className={`mt-3 rounded-sm p-2.5 text-sm font-semibold ${msg.ok ? "bg-green-50 text-green-800" : "bg-accent-red/10 text-accent-red"}`}
            >
              {msg.text}
            </p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <Button
              type="button"
              onClick={save}
              disabled={busy || !reply.trim()}
            >
              {busy
                ? "Saving…"
                : brief.hasQuiz
                  ? "Replace the quiz"
                  : "Save quiz"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={busy}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
