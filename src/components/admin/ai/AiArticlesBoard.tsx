"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  generateBriefsAction,
  getBriefViewsAction,
  publishBriefAction,
  saveBriefNotesAction,
  stopGenerationAction,
} from "@/app/actions/admin-ai-articles";
import type { BriefView } from "@/lib/ai-article/views";
import { randomBackdatedPublishedAt } from "@/lib/random-backdate";
import { Badge, Button, Card, LinkButton, Textarea } from "../ui";
import { ImageWizard } from "./ImageWizard";
import { ArticleDialog, QuizDialog } from "./ManualDialogs";

type Filter = "all" | "todo" | "drafts" | "published";

const STATUS_TONE: Record<
  BriefView["status"],
  "default" | "success" | "warning" | "danger"
> = {
  PENDING: "default",
  QUEUED: "warning",
  GENERATING: "warning",
  DRAFTED: "warning",
  PUBLISHED: "success",
  FAILED: "danger",
};
const STATUS_LABEL: Record<BriefView["status"], string> = {
  PENDING: "Not generated",
  QUEUED: "Queued",
  GENERATING: "Writing…",
  DRAFTED: "Draft",
  PUBLISHED: "Published",
  FAILED: "Failed",
};

const usd = (n: number) => `$${n.toFixed(n < 1 ? 2 : 1)}`;

export function AiArticlesBoard({
  initial,
  keyConfigured,
}: {
  initial: BriefView[];
  keyConfigured: boolean;
}) {
  const [briefs, setBriefs] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [wizardFor, setWizardFor] = useState<string | null>(null);
  const [publishFor, setPublishFor] = useState<BriefView | null>(null);
  const [articleFor, setArticleFor] = useState<{
    id: string;
    notes: string;
  } | null>(null);
  const [quizFor, setQuizFor] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setBriefs(await getBriefViewsAction());
    } catch {
      /* a dropped poll is harmless; the next one will catch up */
    }
  }, []);

  const active = briefs.some(
    (b) => b.status === "QUEUED" || b.status === "GENERATING",
  );
  useEffect(() => {
    const t = setInterval(refresh, active ? 4000 : 30000);
    return () => clearInterval(t);
  }, [active, refresh]);

  const counts = useMemo(() => {
    const c = { todo: 0, working: 0, drafts: 0, published: 0, failed: 0 };
    for (const b of briefs) {
      if (b.status === "PENDING") c.todo++;
      else if (b.status === "QUEUED" || b.status === "GENERATING") c.working++;
      else if (b.status === "DRAFTED") c.drafts++;
      else if (b.status === "PUBLISHED") c.published++;
      else c.failed++;
    }
    return c;
  }, [briefs]);

  const visible = briefs.filter((b) => {
    if (filter === "todo")
      return (
        b.status === "PENDING" ||
        b.status === "FAILED" ||
        b.status === "QUEUED" ||
        b.status === "GENERATING"
      );
    if (filter === "drafts") return b.status === "DRAFTED";
    if (filter === "published") return b.status === "PUBLISHED";
    return true;
  });

  async function generate(ids: string[], confirmText?: string) {
    if (!keyConfigured) {
      setMessage("Add your Claude API key first (Settings → AI Articles).");
      return;
    }
    if (confirmText && !window.confirm(confirmText)) return;
    setMessage(null);
    const { queued } = await generateBriefsAction(ids);
    setMessage(
      queued
        ? `${queued} article${queued > 1 ? "s" : ""} queued. They're written one at a time.`
        : "Nothing to queue.",
    );
    await refresh();
  }

  const pending = briefs.filter((b) => b.status === "PENDING");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge>{counts.todo} to generate</Badge>
        {counts.working > 0 && (
          <Badge tone="warning">{counts.working} in progress</Badge>
        )}
        <Badge tone="warning">{counts.drafts} drafts</Badge>
        <Badge tone="success">{counts.published} published</Badge>
        {counts.failed > 0 && (
          <Badge tone="danger">{counts.failed} failed</Badge>
        )}
      </div>

      {active && (
        <div className="flex flex-wrap items-center gap-3 rounded-sm bg-amber-50 p-3 text-sm text-amber-900">
          <span className="font-semibold">Claude API writing is running.</span>
          <Button
            type="button"
            variant="danger"
            onClick={async () => {
              await stopGenerationAction();
              setMessage(
                "Stopped. The request in flight was cancelled and the waiting articles were un-queued.",
              );
              await refresh();
            }}
          >
            Stop now
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {keyConfigured && (
          <details className="border-line rounded-sm border p-3 text-sm">
            <summary className="cursor-pointer font-semibold">
              Automatic writing with the Claude API (uses paid credits)
            </summary>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={() =>
                  generate(
                    pending.slice(0, 3).map((b) => b.id),
                    "Write the next 3 articles with the Claude API? Each one uses API credits (typically a few tenths of a dollar to about a dollar).",
                  )
                }
                disabled={pending.length === 0}
              >
                Generate next 3
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  generate(
                    pending.map((b) => b.id),
                    `Write all ${pending.length} remaining articles with the Claude API? They run one after another and use API credits (typically ${usd(pending.length * 0.4)}–${usd(pending.length * 1)} in total).`,
                  )
                }
                disabled={pending.length === 0}
              >
                Generate all ({pending.length})
              </Button>
            </div>
          </details>
        )}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="border-line ml-auto rounded-sm border bg-white px-3 py-2 text-sm"
          aria-label="Filter"
        >
          <option value="all">All</option>
          <option value="todo">To generate / in progress</option>
          <option value="drafts">Drafts</option>
          <option value="published">Published</option>
        </select>
      </div>

      {message && <p className="text-muted text-sm">{message}</p>}

      <div className="space-y-3">
        {visible.length === 0 && (
          <p className="text-muted py-8 text-center text-sm">Nothing here.</p>
        )}
        {visible.map((b) => (
          <BriefCard
            key={b.id}
            brief={b}
            keyConfigured={keyConfigured}
            onGenerate={(confirmText) => generate([b.id], confirmText)}
            onArticle={(notes) => setArticleFor({ id: b.id, notes })}
            onQuiz={() => setQuizFor(b.id)}
            onImages={() => setWizardFor(b.id)}
            onPublish={() => setPublishFor(b)}
          />
        ))}
      </div>

      {wizardFor && (
        <ImageWizard
          briefId={wizardFor}
          onChanged={refresh}
          onClose={() => {
            setWizardFor(null);
            void refresh();
          }}
        />
      )}
      {articleFor && briefs.find((x) => x.id === articleFor.id) && (
        <ArticleDialog
          brief={briefs.find((x) => x.id === articleFor.id)!}
          notes={articleFor.notes}
          onSaved={() => void refresh()}
          onClose={() => {
            setArticleFor(null);
            void refresh();
          }}
        />
      )}
      {quizFor && briefs.find((x) => x.id === quizFor) && (
        <QuizDialog
          brief={briefs.find((x) => x.id === quizFor)!}
          onSaved={() => void refresh()}
          onClose={() => {
            setQuizFor(null);
            void refresh();
          }}
        />
      )}
      {publishFor && (
        <PublishDialog
          brief={publishFor}
          onClose={() => {
            setPublishFor(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}

function BriefCard({
  brief: b,
  keyConfigured,
  onGenerate,
  onArticle,
  onQuiz,
  onImages,
  onPublish,
}: {
  brief: BriefView;
  keyConfigured: boolean;
  onGenerate: (confirmText?: string) => void;
  onArticle: (notes: string) => void;
  onQuiz: () => void;
  onImages: () => void;
  onPublish: () => void;
}) {
  const [notes, setNotes] = useState(b.notes ?? "");
  const canEditNotes =
    b.first &&
    (b.status === "PENDING" || b.status === "FAILED" || b.status === "DRAFTED");
  const imagesComplete = b.slotsTotal > 0 && b.slotsDone === b.slotsTotal;

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted text-xs font-bold">
            #{String(b.briefNo).padStart(2, "0")} · {b.categoryName} · {b.type}
          </p>
          <h3 className="mt-0.5 text-base leading-snug font-extrabold">
            {b.title}
          </h3>
          <p className="text-muted mt-1 text-xs">Primary keyword: {b.pk}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {b.first && <Badge tone="warning">First-hand notes</Badge>}
          {b.tsens && <Badge>Time-sensitive</Badge>}
          <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
        </div>
      </div>

      {canEditNotes && (
        <label className="block text-sm">
          <span className="font-semibold">Your real first-hand notes</span>
          <span className="text-muted">
            {" "}
            — what you tested, for how long, results, costs. Leave empty and
            Claude writes an honest research-based version instead.
          </span>
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => void saveBriefNotesAction(b.id, notes)}
            className="mt-1"
          />
        </label>
      )}

      {b.status === "FAILED" && b.message && (
        <p className="bg-accent-red/10 text-accent-red rounded-sm p-2.5 text-sm font-semibold">
          {b.message}
        </p>
      )}
      {b.status === "DRAFTED" && b.message && (
        <ul className="list-disc space-y-0.5 rounded-sm bg-amber-50 p-2.5 pl-6 text-xs text-amber-900">
          {b.message.split(" | ").map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
      {(b.status === "QUEUED" || b.status === "GENERATING") && (
        <p className="text-muted text-sm">
          {b.status === "QUEUED"
            ? "Waiting for its turn…"
            : "Claude is researching and writing (usually 2–5 minutes). You can leave this page."}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {b.status !== "QUEUED" &&
          b.status !== "GENERATING" &&
          b.status !== "PUBLISHED" && (
            <Button
              type="button"
              variant={b.status === "DRAFTED" ? "secondary" : "primary"}
              onClick={() => onArticle(notes)}
            >
              1 · Article{b.status === "DRAFTED" ? " ✓" : ""}
            </Button>
          )}
        {keyConfigured && (b.status === "PENDING" || b.status === "FAILED") && (
          <Button type="button" variant="ghost" onClick={() => onGenerate()}>
            {b.status === "FAILED" ? "Retry with API" : "Write with API"}
          </Button>
        )}
        {b.status === "DRAFTED" && (
          <>
            <Button type="button" onClick={onImages}>
              2 · Images ({b.slotsDone}/{b.slotsTotal})
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onPublish}
              disabled={!imagesComplete}
            >
              Publish
            </Button>
            {b.articleId && (
              <LinkButton href={`/adminiyad/articles/${b.articleId}/edit`}>
                Edit draft
              </LinkButton>
            )}
            {keyConfigured && (
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  onGenerate(
                    "Write this article again with the API? The current draft and any images you pasted into it are replaced, and it uses API credits.",
                  )
                }
              >
                Regenerate with API
              </Button>
            )}
          </>
        )}
        {b.status === "PUBLISHED" && b.slug && (
          <>
            <LinkButton href={`/story/${b.slug}`}>View live</LinkButton>
            {b.articleId && (
              <LinkButton href={`/adminiyad/articles/${b.articleId}/edit`}>
                Edit
              </LinkButton>
            )}
            <Button type="button" onClick={onQuiz}>
              3 · Quiz{b.hasQuiz ? " ✓" : ""}
            </Button>
          </>
        )}
        {b.costUsd != null && (
          <span className="text-muted ml-auto text-xs">
            ≈ {usd(b.costUsd)}
            {b.webSearches != null ? ` · ${b.webSearches} searches` : ""}
          </span>
        )}
      </div>
    </Card>
  );
}

function PublishDialog({
  brief,
  onClose,
}: {
  brief: BriefView;
  onClose: () => void;
}) {
  // Computed once on open (client only), never during render, so SSR can't mismatch.
  const [when, setWhen] = useState(() => randomBackdatedPublishedAt());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ slug: string; warnings: string[] } | null>(
    null,
  );

  async function publish() {
    setBusy(true);
    setError(null);
    const res = await publishBriefAction(brief.id, when);
    setBusy(false);
    if (res.ok) setDone({ slug: res.slug, warnings: res.warnings });
    else setError(res.error);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Publish article"
    >
      <div className="bg-canvas w-full max-w-md rounded-xl p-6 shadow-xl">
        {done ? (
          <>
            <h2 className="text-lg font-extrabold">Published ✓</h2>
            <p className="text-muted mt-1 text-sm">The article is live.</p>
            {done.warnings.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 rounded-sm bg-amber-50 p-3 pl-6 text-xs text-amber-900">
                {done.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex gap-3">
              <LinkButton href={`/story/${done.slug}`} variant="primary">
                View live
              </LinkButton>
              <Button type="button" variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-extrabold">Publish this article?</h2>
            <p className="text-muted mt-1 text-sm">{brief.title}</p>
            <label className="mt-4 block text-sm font-semibold">
              Publish date
              <input
                type="datetime-local"
                value={when}
                onChange={(e) => setWhen(e.target.value)}
                className="border-line mt-1 w-full rounded-sm border px-3 py-2 text-sm"
              />
              <span className="text-muted mt-1 block text-xs font-normal">
                Pre-filled with a random date in the last 60 days, like every
                new article. Change it if you want.
              </span>
            </label>
            {error && (
              <p
                role="alert"
                className="bg-accent-red/10 text-accent-red mt-3 rounded-sm p-2.5 text-sm font-semibold"
              >
                {error}
              </p>
            )}
            <div className="mt-5 flex gap-3">
              <Button type="button" onClick={publish} disabled={busy || !when}>
                {busy ? "Publishing…" : "Publish now"}
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
          </>
        )}
      </div>
    </div>
  );
}
