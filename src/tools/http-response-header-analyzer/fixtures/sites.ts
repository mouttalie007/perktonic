import type { FakePage } from "./mockFetcher";

/** The "Try an example" URL; the fixture copies the headers https://github.com/ sent on 29 Oct 2026 (CSP shortened). */
export const EXAMPLE_URL = "https://github.com/";

export const STRONG: Record<string, FakePage> = {
  "https://github.com/": {
    status: 200,
    headers: {
      "cache-control": "max-age=0, private, must-revalidate",
      "content-encoding": "gzip",
      "content-security-policy": "default-src 'none'; base-uri 'self'; connect-src 'self' api.github.com; font-src github.githubassets.com; frame-ancestors 'none'; img-src 'self' data: github.githubassets.com; script-src github.githubassets.com; style-src 'unsafe-inline' github.githubassets.com",
      "content-type": "text/html; charset=utf-8",
      etag: 'W/"cae1d71291a2f62764bfcd2bf07bcaca"',
      "referrer-policy": "origin-when-cross-origin, strict-origin-when-cross-origin",
      server: "github.com",
      "set-cookie": [
        "_gh_sess=abc; path=/; secure; HttpOnly; SameSite=Lax",
        "_octo=GH1.1.9621; expires=Fri, 29 Oct 2027 20:45:17 GMT; domain=.github.com; path=/; secure; SameSite=Lax",
        "logged_in=no; expires=Fri, 29 Oct 2027 20:45:17 GMT; domain=.github.com; path=/; HttpOnly; secure; SameSite=Lax",
      ],
      "strict-transport-security": "max-age=31536000; includeSubdomains; preload",
      vary: "Accept-Encoding, Accept, X-Requested-With",
      "x-content-type-options": "nosniff",
      "x-frame-options": "deny",
      "x-xss-protection": "0",
    },
  },
};

/** A typical older PHP site: weak or missing security headers, version leaks, no compression. */
export const WEAK: Record<string, FakePage> = {
  "http://shop.example.com/": { status: 301, headers: { location: "https://shop.example.com/" } },
  "https://shop.example.com/": {
    status: 200,
    headers: {
      "content-type": "text/html; charset=UTF-8",
      server: "Apache/2.4.41 (Ubuntu)",
      "x-powered-by": "PHP/7.4.3",
      "strict-transport-security": "max-age=86400",
      "content-security-policy": "default-src * 'unsafe-inline' 'unsafe-eval'",
      "x-frame-options": "ALLOW-FROM https://partner.example.com",
      "referrer-policy": "unsafe-url",
      "cache-control": "no-store, max-age=3600, public",
      "set-cookie": ["PHPSESSID=r2t5uvjq435r4q7ib3vtdjq120; path=/", "promo=spring; SameSite=None"],
    },
  },
};

/** A server that refuses HEAD with 405 and only reveals its headers on GET. */
export const HEAD_REFUSED: Record<string, FakePage> = {
  "HEAD https://api.example.org/status": { status: 405, headers: { allow: "GET" } },
  "GET https://api.example.org/status": {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "public, max-age=60", "x-content-type-options": "nosniff" },
    body: JSON.stringify({ ok: true, padding: "x".repeat(200_000) }),
  },
};
