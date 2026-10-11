/**
 * Custom next/image loader (next.config.ts's images.loader: "custom").
 * Next's own built-in /_next/image optimizer returns 400 on this host (see
 * next.config.ts's prior history), so this bypasses it entirely -- no
 * request ever goes through it. Instead it maps a requested width onto
 * pre-generated variant files that admin-media.ts writes at upload time
 * (<key>-640.webp, <key>-1080.webp, alongside the original <key>.webp),
 * purely by string manipulation on the URL -- the loader has no DB access,
 * so the naming convention IS the contract between this file and
 * admin-media.ts's performUpload().
 *
 * External/remote images (picsum, unsplash, randomuser.me, Cloudinary, R2)
 * were never processed by our pipeline, so they pass through unchanged.
 */
export default function perktonicLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  if (!src.startsWith("/uploads/") || !src.endsWith(".webp")) return src;

  const base = src.slice(0, -".webp".length);
  // Already a derived variant (og/640/1080) -- never chain onto itself.
  if (/-(og|640|1080)$/.test(base)) return src;

  if (width <= 640) return `${base}-640.webp`;
  if (width <= 1080) return `${base}-1080.webp`;
  return src;
}
