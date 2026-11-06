import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FakePage } from "./mockFetcher";
import { gifHeader, jpegHeader, pngHeader, webpHeader } from "./images";

import { EXAMPLE_URL } from "./example";

export { EXAMPLE_URL };

/** Mirrors what https://nodejs.org/en served on 29 Oct 2026 (head only; images reduced to their headers). */

const OG = "https://nodejs.org/en/next-data/og/announcement/Node.js%20%E2%80%94%20Run%20JavaScript%20Everywhere";
export const NODEJS: Record<string, FakePage> = {
  [EXAMPLE_URL]: { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, body: readFileSync(join(__dirname, "nodejs-head.html"), "utf8") },
  [OG]: { status: 200, headers: { "content-type": "image/png", "content-length": "127708" }, body: pngHeader(1200, 600) },
  "https://nodejs.org/static/images/logo-hexagon-card.png": { status: 200, headers: { "content-type": "image/png", "content-length": "8317" }, body: pngHeader(224, 256) },
};

const page = (head: string) => ({ status: 200, headers: { "content-type": "text/html; charset=utf-8" }, body: `<!doctype html><html lang="en"><head>${head}</head><body><p>Hello</p></body></html>` });

/** Relative og:image, a tiny square image, an invalid twitter:card and noindex. */
export const PROBLEMS: Record<string, FakePage> = {
  "https://blog.example.com/post/42": page(`
    <title>Post</title>
    <meta name="robots" content="noindex, follow">
    <link rel="canonical" href="https://blog.example.com/posts/42/">
    <meta property="og:title" content="Why we moved to Postgres">
    <meta property="og:image" content="/img/thumb.gif">
    <meta property="og:url" content="https://blog.example.com/post/42">
    <meta name="twitter:card" content="large_image">`),
  "https://blog.example.com/img/thumb.gif": { status: 200, headers: { "content-type": "image/gif" }, body: gifHeader(150, 150) },
};

/** A shop page whose image is 6 MB and square-ish, with declared sizes that do not match. */
export const HEAVY: Record<string, FakePage> = {
  "https://shop.example.com/p/kettle": page(`
    <title>Stainless steel kettle 1.7 L – Example Shop</title>
    <meta name="description" content="A 1.7 litre stainless steel kettle with a 3000 W element, auto shut-off and a removable limescale filter.">
    <link rel="canonical" href="https://shop.example.com/p/kettle">
    <meta property="og:type" content="product">
    <meta property="og:title" content="Stainless steel kettle 1.7 L">
    <meta property="og:description" content="Boils a full jug in under 4 minutes.">
    <meta property="og:url" content="https://shop.example.com/p/kettle">
    <meta property="og:image" content="https://cdn.example.com/kettle.jpg">
    <meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="Silver kettle on a kitchen counter">
    <meta name="twitter:card" content="summary_large_image">`),
  "https://cdn.example.com/kettle.jpg": { status: 200, headers: { "content-type": "image/jpeg", "content-length": String(6 * 1024 * 1024) }, body: jpegHeader(1000, 1000) },
};

/** Everything set correctly, with a WebP image served after a redirect. */
export const GOOD: Record<string, FakePage> = {
  "http://good.example.org/": { status: 301, headers: { location: "https://good.example.org/" } },
  "https://good.example.org/": page(`
    <title>Good Example – Tools for tidy teams</title>
    <meta name="description" content="Plan projects, share files and track time in one place. Free for teams of up to 5 people.">
    <link rel="canonical" href="https://good.example.org/">
    <meta property="og:type" content="website"><meta property="og:url" content="https://good.example.org/">
    <meta property="og:title" content="Good Example – Tools for tidy teams">
    <meta property="og:description" content="Plan projects, share files and track time in one place.">
    <meta property="og:image" content="https://good.example.org/share.webp"><meta property="og:image:alt" content="Dashboard screenshot">
    <meta name="twitter:card" content="summary_large_image">`),
  "https://good.example.org/share.webp": { status: 302, headers: { location: "https://img.example.org/share-1200.webp" } },
  "https://img.example.org/share-1200.webp": { status: 200, headers: { "content-type": "image/webp", "content-length": "84211" }, body: webpHeader(1200, 630) },
};
