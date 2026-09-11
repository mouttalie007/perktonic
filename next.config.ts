import type { NextConfig } from "next";

// Third-party origins the site actually loads, given consent (Phase 9). Kept
// in one place so the CSP and the script tags that load them can't drift.
const CSP_GOOGLE_SCRIPT_ORIGINS = [
  "https://www.googletagmanager.com",
  "https://pagead2.googlesyndication.com",
  "https://*.googlesyndication.com",
  "https://*.google-analytics.com",
  "https://*.doubleclick.net",
];

// Note on 'unsafe-inline' in script-src: Ad Units are admin-authored raw
// HTML/JS snippets (spec §46 — we never rewrite third-party ad markup), and
// the GA4/GTM bootstrap loaders above are also inline by design. A strict
// nonce-based CSP would break both. This is a deliberate, documented
// trade-off, not an oversight — everything else here is locked down.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${CSP_GOOGLE_SCRIPT_ORIGINS.join(" ")}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com ${CSP_GOOGLE_SCRIPT_ORIGINS.join(" ")}`,
  "frame-src 'self' https://*.doubleclick.net https://googleads.g.doubleclick.net",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy", value: CSP },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,

  // Typed <Link href> / router (spec §86 — type safety).
  typedRoutes: true,

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },

  images: {
    // Modern formats first (spec §15, §43).
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Dev/demo placeholder imagery (seed data only).
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
      // Production media CDNs — activated when MEDIA_PROVIDER is set.
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "**.r2.dev" },
    ],
  },
};

export default nextConfig;
