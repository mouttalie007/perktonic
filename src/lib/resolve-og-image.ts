type MediaLike = { url: string; ogUrl?: string | null } | null | undefined;

/**
 * Picks the first available image in priority order (e.g. explicit OG image
 * before featured image), preferring that image's own 1200x630 cropped
 * social variant and falling back to its raw url only if it has none.
 */
export function resolveOgImage(...candidates: MediaLike[]): string | undefined {
  for (const m of candidates) {
    if (m) return m.ogUrl || m.url;
  }
  return undefined;
}
