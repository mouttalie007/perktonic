import { CURRENCIES, LIMITS, type Currency, type Field, type Per } from "./roi";

export type RawInputs = Record<Exclude<Field, "per">, string> & { per: Per };

const KEYS: Exclude<Field, "per">[] = ["count", "minutesPerTask", "people", "hourlyCost", "buildCost", "monthlyCost", "automatedPercent", "workingDaysPerYear"];
const SHORT: Record<Exclude<Field, "per">, string> = { count: "n", minutesPerTask: "min", people: "ppl", hourlyCost: "rate", buildCost: "build", monthlyCost: "monthly", automatedPercent: "auto", workingDaysPerYear: "days" };

/**
 * Inputs as a readable URL fragment (#n=20&per=day&…). Browsers never send the
 * fragment to the server, so the numbers stay with the people who share the link.
 */
export function encodeState(raw: RawInputs, currency: Currency): string {
  const p = new URLSearchParams();
  for (const k of KEYS) p.set(SHORT[k], raw[k].trim());
  p.set("per", raw.per);
  p.set("cur", currency);
  return p.toString();
}

export type Decoded = { ok: true; raw: RawInputs; currency: Currency } | { ok: false; error: string } | null;

/** Reads a fragment back. Anyone can edit a URL, so every value is checked; null = no shared inputs. */
export function decodeState(fragment: string): Decoded {
  const p = new URLSearchParams(fragment.replace(/^#/, ""));
  if (!p.has("n") && !p.has("rate")) return null;
  const raw = { per: "day" } as RawInputs;
  for (const k of KEYS) {
    const v = p.get(SHORT[k]);
    if (v === null || v.length > 20 || !/^[\d.,\s_-]*$/.test(v)) return { ok: false, error: `The shared link has an invalid value for “${LIMITS[k].label}”. The example is shown instead.` };
    raw[k] = v;
  }
  const per = p.get("per");
  if (per !== "day" && per !== "week" && per !== "month") return { ok: false, error: "The shared link has an invalid period. The example is shown instead." };
  raw.per = per;
  const cur = p.get("cur") ?? "USD";
  if (!(CURRENCIES as readonly string[]).includes(cur)) return { ok: false, error: "The shared link has an unknown currency. The example is shown instead." };
  return { ok: true, raw, currency: cur as Currency };
}
