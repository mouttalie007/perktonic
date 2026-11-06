import { guessColumn, standardizeAmount } from "./amounts";
import { standardizeCountry, toAlpha2 } from "./country";
import { standardizeEmail } from "./email";
import { standardizeName } from "./names";
import { standardizePhone } from "./phone";
import { MAX_INVALID_KEPT, type ColumnRule, type ColumnStats, type InvalidEntry, type Options, type Outcome, type Rule } from "./types";

/** Picks a likely rule from the header name, then from what the first values look like. */
export function suggestRule(header: string, values: string[]): Rule {
  const h = header.toLowerCase();
  if (/(phone|mobile|tel|cell|whatsapp|fax|t[ée]l[ée]phone|portable|m[óo]vil|telefon)/.test(h)) return "phone";
  if (/(e-?mail|courriel|correo)/.test(h)) return "email";
  if (/(country|pays|pa[íi]s|land\b|nation)/.test(h)) return "country";
  if (/(amount|price|total|cost|revenue|salary|montant|prix|importe|betrag|balance|fee)/.test(h)) return "amount";
  if (/(^|_|\s)(first|last|full|given|family|sur)?_?\s?name|nom|pr[ée]nom|nombre|apellido|vorname|nachname|contact/.test(h) && !/(company|file|user|product|city|street|domain|host)/.test(h)) return "name";
  const sample = values.filter((v) => v.trim()).slice(0, 50);
  if (sample.length === 0) return "none";
  const share = (re: RegExp) => sample.filter((v) => re.test(v.trim())).length / sample.length;
  if (share(/^[^@\s]+@[^@\s]+\.[^@\s]+$/) > 0.8) return "email";
  if (share(/^(\+|00)?[\d\s().-]{7,}(\s*(x|ext\.?)\s*\d+)?$/i) > 0.8) return "phone";
  return "none";
}

export interface ApplyResult {
  header: string[];
  rows: string[][];
  stats: ColumnStats[];
  invalid: InvalidEntry[];
  invalidTotal: number;
  /** Output column index for each input column (extension columns shift the ones after them). */
  outIndex: number[];
}

/**
 * Applies one rule per column. Invalid or unfixable values are kept as they
 * were in the output and listed separately with their line number, never dropped.
 */
/**
 * With `onRow`, each output row is handed over as soon as it is ready and only
 * the first `keep` rows are returned, so a large file is not held twice.
 */
export function applyRules(header: string[], rows: string[][], rules: ColumnRule[], opts: Options, onProgress?: (done: number) => void, onRow?: (row: string[]) => void, keep = Infinity): ApplyResult {
  const cols = header.length;
  const stats: ColumnStats[] = header.map((column, i) => ({ column, rule: rules[i]?.rule ?? "none", changed: 0, unchanged: 0, invalid: 0, empty: 0, note: null }));
  const amountCfg = new Map<number, { style: "dot" | "comma"; target: string | null }>();
  rules.forEach((r, i) => {
    if (r.rule !== "amount") return;
    const g = guessColumn(rows.map((row) => row[i] ?? ""));
    const style = r.decimal && r.decimal !== "auto" ? r.decimal : g.style;
    const target = opts.currency === "auto" ? g.currency : opts.currency;
    amountCfg.set(i, { style, target });
    stats[i].note =
      (r.decimal && r.decimal !== "auto" ? `Read as ${style === "dot" ? "1,234.56" : "1.234,56"} (your choice)` : `Detected ${g.style === "dot" ? "1,234.56" : "1.234,56"} from ${g.evidence} value${g.evidence === 1 ? "" : "s"}${g.ambiguous ? `; ${g.ambiguous} could be read either way` : ""}`) +
      (target ? `; currency ${target}${opts.currency === "auto" ? " (most common)" : ""}` : "; no currency found");
  });
  const phoneCols = rules.map((r, i) => (r.rule === "phone" ? i : -1)).filter((i) => i >= 0);
  const outHeader: string[] = [];
  const outIndex: number[] = [];
  for (let i = 0; i < cols; i++) {
    outIndex.push(outHeader.length);
    outHeader.push(header[i]);
    if (phoneCols.includes(i)) outHeader.push(`${header[i] || `column_${i + 1}`}_ext`);
  }
  const invalid: InvalidEntry[] = [];
  let invalidTotal = 0;
  const out: string[][] = [];
  const countryCache = new Map<string, string | null>();
  const countryOutcome = new Map<string, Outcome>();
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const o: string[] = [];
    for (let i = 0; i < cols; i++) {
      const raw = row[i] ?? "";
      const rule = rules[i]?.rule ?? "none";
      let res: Outcome;
      switch (rule) {
        case "phone": {
          let country = opts.phoneCountry;
          if (opts.phoneCountryColumn >= 0) {
            const c = row[opts.phoneCountryColumn] ?? "";
            if (!countryCache.has(c)) countryCache.set(c, toAlpha2(c));
            country = countryCache.get(c) ?? opts.phoneCountry;
          }
          res = standardizePhone(raw, country);
          break;
        }
        case "email":
          res = standardizeEmail(raw);
          break;
        case "name":
          res = standardizeName(raw);
          break;
        case "amount": {
          const cfg = amountCfg.get(i)!;
          res = standardizeAmount(raw, cfg.style, cfg.target, opts.amountOutput, opts.currencyLabel);
          break;
        }
        case "country": {
          // Country columns repeat a few values many times, and name lookup is the slow part.
          let cached = countryOutcome.get(raw);
          if (!cached) {
            cached = standardizeCountry(raw, opts.countryOutput);
            countryOutcome.set(raw, cached);
          }
          res = cached;
          break;
        }
        default:
          res = raw === "" ? { kind: "empty" } : { kind: "unchanged", value: raw };
      }
      const s = stats[i];
      if (res.kind === "empty") {
        s.empty++;
        o.push(raw);
      } else if (res.kind === "unchanged") {
        s.unchanged++;
        o.push(res.value);
      } else if (res.kind === "changed") {
        s.changed++;
        o.push(res.value);
      } else {
        s.invalid++;
        invalidTotal++;
        if (invalid.length < MAX_INVALID_KEPT) invalid.push({ row: r + 2, column: header[i], value: raw, reason: res.reason });
        o.push(raw);
      }
      if (rule === "phone") o.push(res.kind === "changed" || res.kind === "invalid" ? (res.extra ?? "") : "");
    }
    if (onRow) onRow(o);
    if (out.length < keep) out.push(o);
    if (onProgress && r % 5000 === 0) onProgress(r);
  }
  return { header: outHeader, rows: out, stats, invalid, invalidTotal, outIndex };
}
