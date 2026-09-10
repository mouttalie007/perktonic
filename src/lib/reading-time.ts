const WORDS_PER_MINUTE = 220;

/** Estimated reading time in whole minutes (minimum 1). */
export function readingTimeMinutes(text: string): number {
  const plain = text.replace(/<[^>]*>/g, " ");
  const words = plain.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/** Reading time for a listicle: intro + every item description. */
export function listicleReadingTimeMinutes(
  intro: string,
  itemDescriptions: string[],
): number {
  return readingTimeMinutes([intro, ...itemDescriptions].join(" "));
}
