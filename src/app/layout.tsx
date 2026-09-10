import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { SITE } from "@/config/site";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
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
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="bg-canvas text-ink flex min-h-full flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
