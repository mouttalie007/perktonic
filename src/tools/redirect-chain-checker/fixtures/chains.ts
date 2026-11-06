import type { FakePage } from "./mockFetcher";

const html = (body: string) => ({ status: 200, headers: { "content-type": "text/html; charset=utf-8" }, body });

/** Mirrors http://www.github.com as checked on 29 Oct 2026: HTTPS and the bare host are fixed in two separate hops. Also the "Try an example" URL. */
export const EXAMPLE_URL = "http://www.github.com/";
export const TWO_HOP: Record<string, FakePage> = {
  "http://www.github.com/": { status: 301, headers: { location: "https://www.github.com/" }, ms: 62 },
  "https://www.github.com/": { status: 301, headers: { location: "https://github.com/" }, ms: 118 },
  "https://github.com/": { ...html("<html><head><title>GitHub</title></head></html>"), ms: 240 },
};

export const LOOP: Record<string, FakePage> = {
  "https://shop.example.com/sale": { status: 302, headers: { location: "/sale/" } },
  "https://shop.example.com/sale/": { status: 301, headers: { location: "https://shop.example.com/sale" } },
};

export const ELEVEN: Record<string, FakePage> = Object.fromEntries(
  Array.from({ length: 12 }, (_, i) => [`https://hops.example.com/${i}`, { status: 301, headers: { location: `/${i + 1}` } }]),
);

export const MIXED: Record<string, FakePage> = {
  "http://example.org/old": { status: 302, headers: { location: "https://example.org/old" } },
  "https://example.org/old": { status: 308, headers: { location: "https://example.org/new" } },
  "https://example.org/new": { status: 307, headers: { location: "https://www.example.org/new" } },
  "https://www.example.org/new": { status: 301, headers: { location: "https://example.org/new/" } },
  "https://example.org/new/": html("<p>ok</p>"),
};

export const DOWNGRADE: Record<string, FakePage> = {
  "https://legacy.example.net/": { status: 301, headers: { location: "http://legacy.example.net/home" } },
  "http://legacy.example.net/home": html("<p>home</p>"),
};

export const CLIENT_SIDE: Record<string, FakePage> = {
  "https://promo.example.com/": html(`<!doctype html><html><head>
<meta http-equiv="refresh" content="5; url=/landing">
<script>const location = "Paris"; if (!window.ok) { window.location.href = "https://promo.example.com/fallback"; }</script>
</head><body>Redirecting…</body></html>`),
};

export const BROKEN_END: Record<string, FakePage> = {
  "https://example.com/blog": { status: 301, headers: { location: "https://example.com/news" } },
  "https://example.com/news": { status: 404, headers: { "content-type": "text/html" }, body: "Not found" },
};
