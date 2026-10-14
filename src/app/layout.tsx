import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { SITE } from "@/config/site";
import { BackToTop } from "@/components/site/BackToTop";
// Consent banner + analytics scripts live in (site)/layout.tsx, not here —
// they're a public-site concern and were blocking the admin UI (the
// banner sits over form submit buttons; found while testing the new GA4
// admin field, 2026-09-13). The admin route group intentionally has none
// of this: staff using an internal tool don't need a cookie-consent
// prompt, and admin pages shouldn't load third-party analytics anyway.

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// Headline font (homepage redesign, 2026-09-12). The reference design is
// BuzzFeed's actual site, whose headline typeface is Proxima Nova — a
// commercial font (Adobe Fonts license) we don't have access to. Plus
// Jakarta Sans is the closest freely-licensed match in weight and
// proportions and is used for headings/titles only; Inter remains the body
// and UI font.
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["700", "800"],
  // Named "-google", not "--font-heading" — globals.css's Tailwind theme
  // token `--font-heading` is the public font-family stack built from this.
  variable: "--font-heading-google",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default:
      "PerkTonic — Free Samples, AI Tools, Rewards & Money-Saving Guides",
    template: "%s — PerkTonic",
  },
  description: SITE.description,
  applicationName: SITE.shortName,
  openGraph: {
    siteName: SITE.shortName,
    type: "website",
    locale: SITE.locale,
  },
  twitter: { card: "summary_large_image" },
  // Google Search Console ownership (HTML tag method). A public token, not a secret.
  verification: { google: "t7CaLm5cNWIb73SRwNgb_MsDjltN_0jsKNhbvlvWJEo" },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${plusJakarta.variable} h-full`}>
      <head>
        {/* Zod v4 probes `new Function("")` once per load to decide whether
            it can use a faster JIT-compiled validator path. It's wrapped in
            try/catch and always degrades gracefully, but our CSP has no
            'unsafe-eval' in script-src (by design), so strict browsers log
            the caught throw as a blocked securitypolicyviolation anyway --
            Zod's own source (node_modules/zod/v4/core/util.js) has a
            comment acknowledging this exact case, and exposes `jitless` to
            skip the probe. No functional or security trade-off: we were
            never allowing eval, this just stops Zod from asking.
            Must run as a raw blocking inline script in <head>, before any
            webpack chunk -- which chunk's code executes first varies by
            route (confirmed: a prior fix that set this from a "use client"
            component worked on the homepage but not on article pages,
            because that page's own schema-validating chunk sometimes wins
            the race). This sets the same globalThis slot Zod's module
            reads, so by the time Zod's code runs anywhere, the probe is
            already skipped regardless of chunk load order. */}
        <script dangerouslySetInnerHTML={{ __html: "window.__zod_globalConfig={jitless:true};" }} />
      </head>
      <body className="bg-canvas text-ink flex min-h-full flex-col antialiased">
        {children}
        <BackToTop />
      </body>
    </html>
  );
}
