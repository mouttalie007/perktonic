"use client";

import { OPEN_CONSENT_EVENT } from "@/lib/consent";

/** Reopens the consent banner in "customize" mode. Used in the footer. */
export function CookiePreferencesButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
      className={className}
    >
      Cookie Preferences
    </button>
  );
}
