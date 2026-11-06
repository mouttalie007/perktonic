import type { Outcome } from "./types";

/** Name particles that stay lower-case before a surname (van der Berg, da Silva, de la Cruz, bin Rashid, al-Fihri). */
const PARTICLES = new Set(["van", "der", "den", "de", "del", "della", "di", "da", "das", "dos", "du", "la", "le", "von", "zu", "ter", "ten", "bin", "ibn", "bint", "al", "el"]);

const isMixed = (w: string) => w !== w.toLocaleUpperCase() && w !== w.toLocaleLowerCase() && /\p{Lu}/u.test(w.slice(1));

function cap(word: string): string {
  const lower = word.toLocaleLowerCase();
  // Mc + capital: McDonald, McKenzie. "Mac" is not changed, because Mack, Macy and Mace are names too.
  if (/^mc\p{L}{2,}/u.test(lower)) return "Mc" + lower[2].toLocaleUpperCase() + lower.slice(3);
  // O'Neil, D'Angelo: a capital after an apostrophe that follows one letter.
  const apos = /^(\p{L})['’](\p{L})(.*)$/u.exec(lower);
  if (apos) return apos[1].toLocaleUpperCase() + "'" + apos[2].toLocaleUpperCase() + apos[3];
  return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
}

/**
 * Fixes the capitalisation of names typed in ALL CAPS or all lower case,
 * word by word. A word already in mixed case (DeShawn, MacKenzie) is kept as
 * typed. Particles are lower-case unless they are the last word.
 */
export function standardizeName(raw: string): Outcome {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (trimmed === "") return { kind: "empty" };
  if (/[\d@#$%_=<>/\\]/.test(trimmed)) return { kind: "invalid", reason: "contains digits or symbols, so it does not look like a name" };
  const words = trimmed.split(" ");
  const value = words
    .map((w, wi) => {
      const parts = w.split("-");
      return parts
        .map((p, pi) => {
          if (p === "" || isMixed(p)) return p;
          const lastPiece = wi === words.length - 1 && pi === parts.length - 1;
          const lower = p.toLocaleLowerCase();
          // Arabic patronymics start a name with a capital (Ibn Battuta); Dutch and other particles do not (van der Berg).
          const startsName = wi === 0 && pi === 0 && ["ibn", "bin", "bint"].includes(lower);
          if (!lastPiece && !startsName && PARTICLES.has(lower)) return lower;
          return cap(p);
        })
        .join("-");
    })
    .join(" ");
  return value === raw ? { kind: "unchanged", value } : { kind: "changed", value };
}
