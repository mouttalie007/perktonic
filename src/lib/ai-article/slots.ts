/**
 * The ordered image to-do list for one API article, stored as JSON on
 * ArticleBrief.imageSlots. Slot 0 is always the cover (featured) image; the
 * rest map 1:1, in order, to the [IMAGE: ...] tags in the article body.
 */
export interface ImageSlot {
  kind: "cover" | "photo" | "screenshot";
  /** What the admin copies: an image-generation prompt, or screenshot steps. */
  prompt: string;
  alt: string;
  mediaId: string | null;
  url: string | null;
}

export function asSlots(value: unknown): ImageSlot[] {
  return Array.isArray(value) ? (value as ImageSlot[]) : [];
}

/** A readable alt text when the model didn't supply one for a tag. */
export function fallbackAlt(prompt: string, kind: ImageSlot["kind"], primaryKeyword: string): string {
  const cleaned = prompt.replace(/^SCREENSHOT:\s*/i, "").replace(/\s+/g, " ").trim();
  if (kind === "screenshot") return `Screenshot: ${cleaned}`.slice(0, 110).replace(/\s+\S*$/, "").trim() || `Screenshot about ${primaryKeyword}`;
  const firstSentence = cleaned.split(/(?<=[.!?])\s/)[0] ?? cleaned;
  const alt = firstSentence.length > 110 ? firstSentence.slice(0, 110).replace(/\s+\S*$/, "") : firstSentence;
  return alt.replace(/[.\s]+$/, "") || primaryKeyword;
}
