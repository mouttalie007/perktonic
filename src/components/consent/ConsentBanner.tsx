"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  DEFAULT_CONSENT,
  OPEN_CONSENT_EVENT,
  readConsentCookieClient,
  writeConsentCookie,
  type ConsentState,
} from "@/lib/consent";

/**
 * Cookie consent banner (Necessary / Analytics / Advertising / Preferences).
 * Shows once, on first visit with no recorded decision, and can be reopened
 * any time via the footer's "Cookie Preferences" link (dispatches
 * `OPEN_CONSENT_EVENT`). Saving reloads the page so server-rendered script
 * gating (`AnalyticsScripts`) picks up the new decision immediately and any
 * already-loaded third-party script is actually gone, not just un-rendered.
 */
export function ConsentBanner() {
  const [open, setOpen] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [draft, setDraft] = useState<ConsentState>(DEFAULT_CONSENT);

  useEffect(() => {
    // Reading document.cookie (a browser-only API) can't happen during SSR,
    // so the decision to show the banner can only be made after mount —
    // this is the "sync with an external system" case the lint rule exists
    // to distinguish from cascading-render anti-patterns.
    const existing = readConsentCookieClient();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!existing) setOpen(true);

    function onReopen() {
      setDraft(readConsentCookieClient() ?? DEFAULT_CONSENT);
      setCustomizing(true);
      setOpen(true);
    }
    window.addEventListener(OPEN_CONSENT_EVENT, onReopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, onReopen);
  }, []);

  function save(state: ConsentState) {
    writeConsentCookie(state);
    window.location.reload();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[var(--color-ink-deep)] text-white shadow-[0_-8px_24px_rgba(0,0,0,0.25)]"
    >
      <div className="site-container flex flex-col gap-4 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <p className="max-w-2xl text-sm text-white/80">
            We use cookies to run the site and, with your consent, to measure
            traffic and show relevant ads. See our{" "}
            <Link href={"/cookie-policy" as Route} className="font-semibold text-white underline">
              Cookie Policy
            </Link>{" "}
            for details.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setCustomizing((v) => !v)}
              className="rounded-sm border border-white/30 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Customize
            </button>
            <button
              type="button"
              onClick={() => save(DEFAULT_CONSENT)}
              className="rounded-sm border border-white/30 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Reject Non-Essential
            </button>
            <button
              type="button"
              onClick={() => save({ analytics: true, advertising: true, preferences: true })}
              className="bg-brand text-ink hover:bg-brand-strong rounded-sm px-4 py-2 text-sm font-bold transition-colors"
            >
              Accept All
            </button>
          </div>
        </div>

        {customizing && (
          <div className="grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <ConsentToggle label="Necessary" description="Required for the site to function." checked disabled />
            <ConsentToggle
              label="Analytics"
              description="Helps us understand how the site is used."
              checked={draft.analytics}
              onChange={(v) => setDraft((d) => ({ ...d, analytics: v }))}
            />
            <ConsentToggle
              label="Advertising"
              description="Personalized ads and ad measurement."
              checked={draft.advertising}
              onChange={(v) => setDraft((d) => ({ ...d, advertising: v }))}
            />
            <ConsentToggle
              label="Preferences"
              description="Remembers choices like display settings."
              checked={draft.preferences}
              onChange={(v) => setDraft((d) => ({ ...d, preferences: v }))}
            />
            <div className="sm:col-span-2 lg:col-span-4">
              <button
                type="button"
                onClick={() => save(draft)}
                className="bg-brand text-ink hover:bg-brand-strong rounded-sm px-4 py-2 text-sm font-bold transition-colors"
              >
                Save Preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConsentToggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label className={`flex items-start gap-2 text-sm ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-1 h-4 w-4 accent-[var(--color-brand)]"
      />
      <span>
        <span className="block font-semibold text-white">{label}</span>
        <span className="text-white/60">{description}</span>
      </span>
    </label>
  );
}
