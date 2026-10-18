/**
 * Cookie consent (spec Phase 9 — CMP-ready consent gating).
 *
 * Isomorphic (no `server-only`, no `"use client"`): read via `cookies()` on
 * the server to decide whether to render tracking/ad scripts, and read/write
 * via `document.cookie` on the client from the consent banner. A single
 * cookie is the source of truth so there is no server/client drift and no
 * flash of scripts before a decision is recorded.
 *
 * "Necessary" isn't a toggle — the site has no functional cookies that need
 * consent (session cookies are set only after an admin logs in, which is a
 * user-initiated action, not tracking).
 */

export const CONSENT_COOKIE = "vt_consent";
export const CONSENT_COOKIE_MAX_AGE_DAYS = 180;
export const CONSENT_VERSION = 1;

export interface ConsentState {
  analytics: boolean;
  advertising: boolean;
  preferences: boolean;
}

export const DEFAULT_CONSENT: ConsentState = {
  analytics: false,
  advertising: false,
  preferences: false,
};

interface ConsentCookiePayload extends ConsentState {
  v: number;
}

/** Parses the raw cookie value. Returns `null` when absent/corrupt (= no decision yet). */
export function parseConsentCookie(
  raw: string | undefined | null,
): ConsentState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(
      decodeURIComponent(raw),
    ) as Partial<ConsentCookiePayload>;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      parsed.v !== CONSENT_VERSION
    )
      return null;
    return {
      analytics: parsed.analytics === true,
      advertising: parsed.advertising === true,
      preferences: parsed.preferences === true,
    };
  } catch {
    return null;
  }
}

export function serializeConsentCookie(state: ConsentState): string {
  const payload: ConsentCookiePayload = { ...state, v: CONSENT_VERSION };
  return encodeURIComponent(JSON.stringify(payload));
}

/** Client-only: writes the consent cookie (readable by the server on next request). */
export function writeConsentCookie(state: ConsentState) {
  const maxAge = CONSENT_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${CONSENT_COOKIE}=${serializeConsentCookie(state)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/** Client-only: reads the consent cookie from `document.cookie`. */
export function readConsentCookieClient(): ConsentState | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`),
  );
  return parseConsentCookie(match?.[1]);
}

/** Dispatched after a decision is saved without a reload, so script gating can react at once. */
export const CONSENT_CHANGED_EVENT = "vt:consent-changed";

/** Event name dispatched to reopen the banner (e.g. from a footer "Cookie Preferences" link). */
export const OPEN_CONSENT_EVENT = "vt:open-consent";
