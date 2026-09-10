import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,

  // Typed <Link href> / router (spec §86 — type safety).
  typedRoutes: true,

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
