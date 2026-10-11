"use client";

import { useEffect, useRef, useState } from "react";
import { claimQuizCodeAction } from "@/app/actions/quiz";

type Phase = "share" | "waiting" | "reveal";

const COUNTDOWN_SECONDS = 10;

export function CompletionModal({
  slug,
  articleTitle,
  onClose,
}: {
  slug: string;
  articleTitle: string;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("share");
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [code, setCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [loadingCode, setLoadingCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startCountdown() {
    if (phase !== "share") return;
    setPhase("waiting");
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setPhase("reveal");
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function shareTo(platform: "facebook" | "x") {
    const articleUrl = `${window.location.origin}/story/${slug}`;
    const text = `I just finished the "${articleTitle}" quiz on PerkTonic!`;
    const shareUrl =
      platform === "facebook"
        ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`
        : `https://twitter.com/intent/tweet?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(text)}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer,width=600,height=500");
    startCountdown();
  }

  async function revealCode() {
    setLoadingCode(true);
    const res = await claimQuizCodeAction(slug);
    setLoadingCode(false);
    if (res.ok) {
      setCode(res.code);
    } else {
      setCodeError("Something went wrong. Please try again.");
    }
  }

  function copyCode() {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="animate-slide-down bg-canvas w-full max-w-sm rounded-xl p-6 text-center shadow-xl sm:p-8">
        {!code && !codeError && (
          <>
            <p className="text-3xl">🎉</p>
            <h2 className="mt-2 text-xl font-extrabold">Congrats — you finished the quiz!</h2>
            <p className="text-muted mt-2 text-sm">Share it with your friends to unlock your code.</p>

            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => shareTo("facebook")}
                disabled={phase !== "share"}
                className="rounded-sm bg-[#1877F2] px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Facebook
              </button>
              <button
                type="button"
                onClick={() => shareTo("x")}
                disabled={phase !== "share"}
                className="bg-ink rounded-sm px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                X
              </button>
            </div>

            {phase === "waiting" && (
              <div className="mt-6">
                <p className="text-muted mb-2 text-xs font-semibold tracking-wide uppercase">
                  Preparing your code… {secondsLeft}s
                </p>
                <div className="bg-surface h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-brand h-full rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${((COUNTDOWN_SECONDS - secondsLeft) / COUNTDOWN_SECONDS) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {phase === "reveal" && (
              <button
                type="button"
                onClick={revealCode}
                disabled={loadingCode}
                className="bg-brand text-ink hover:bg-brand-strong mt-6 w-full rounded-sm px-6 py-3 text-sm font-bold transition-colors disabled:opacity-60"
              >
                {loadingCode ? "Loading…" : "Show my code"}
              </button>
            )}
          </>
        )}

        {code && (
          <>
            <p className="text-3xl">🎁</p>
            <h2 className="mt-2 text-xl font-extrabold">Here&apos;s your code</h2>
            <div className="bg-surface border-line mt-4 flex items-center justify-center gap-3 rounded-lg border-2 border-dashed py-4">
              <span className="font-mono text-2xl font-extrabold tracking-[0.3em]">{code}</span>
            </div>
            <button
              type="button"
              onClick={copyCode}
              className="bg-ink hover:bg-ink-deep mt-4 w-full rounded-sm px-6 py-3 text-sm font-bold text-white transition-colors"
            >
              {copied ? "Copied!" : "Copy code"}
            </button>
          </>
        )}

        {codeError && <p className="mt-4 text-sm font-semibold">{codeError}</p>}

        <button
          type="button"
          onClick={onClose}
          className="text-muted hover:text-ink mt-6 text-xs font-semibold underline"
        >
          Close
        </button>
      </div>
    </div>
  );
}
