import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { SITE } from "@/config/site";
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
      "ViralTrendly — Trending Stories, Viral News & Stories Worth Sharing",
    template: "%s — ViralTrendly",
  },
  description: SITE.description,
  applicationName: SITE.shortName,
  openGraph: {
    siteName: SITE.shortName,
    type: "website",
    locale: SITE.locale,
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${plusJakarta.variable} h-full`}>
      <body className="bg-canvas text-ink flex min-h-full flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
