import type { Style } from "./convert";

export type Verdict = "yes" | "partly" | "no";

export interface Row {
  topic: string;
  cells: Record<Exclude<Style, "HLOOKUP">, { verdict: Verdict; text: string }>;
}

/** The side-by-side comparison. HLOOKUP behaves like VLOOKUP turned sideways, which the page explains in one line. */
export const COMPARISON: Row[] = [
  {
    topic: "Works in",
    cells: {
      VLOOKUP: { verdict: "yes", text: "Every Excel version, Google Sheets and LibreOffice" },
      "INDEX-MATCH": { verdict: "yes", text: "Every Excel version, Google Sheets and LibreOffice" },
      XLOOKUP: { verdict: "partly", text: "Excel 2021, 2024, Microsoft 365 and the web; Google Sheets; LibreOffice 24.8+. Not Excel 2019 or 2016" },
    },
  },
  {
    topic: "Left lookup (result left of the search column)",
    cells: {
      VLOOKUP: { verdict: "no", text: "Only returns columns to the right of the first column" },
      "INDEX-MATCH": { verdict: "yes", text: "Lookup and result columns are independent" },
      XLOOKUP: { verdict: "yes", text: "Lookup and result arrays are independent" },
    },
  },
  {
    topic: "Safe when columns are inserted or deleted",
    cells: {
      VLOOKUP: { verdict: "no", text: "The column number is typed in, so it points at the wrong column after an insert" },
      "INDEX-MATCH": { verdict: "yes", text: "References move with the columns" },
      XLOOKUP: { verdict: "yes", text: "References move with the columns" },
    },
  },
  {
    topic: "Default match type",
    cells: {
      VLOOKUP: { verdict: "partly", text: "Approximate if the 4th argument is left out: a common source of wrong answers" },
      "INDEX-MATCH": { verdict: "partly", text: "MATCH defaults to approximate (1); type 0 for exact" },
      XLOOKUP: { verdict: "yes", text: "Exact by default" },
    },
  },
  {
    topic: "“Not found” handling",
    cells: {
      VLOOKUP: { verdict: "partly", text: "Needs IFNA or IFERROR around it" },
      "INDEX-MATCH": { verdict: "partly", text: "Needs IFNA or IFERROR around it" },
      XLOOKUP: { verdict: "yes", text: "Built in (if_not_found argument)" },
    },
  },
  {
    topic: "Several result columns at once",
    cells: {
      VLOOKUP: { verdict: "partly", text: "With an array of column numbers such as {2,3} in Excel 365 and Google Sheets" },
      "INDEX-MATCH": { verdict: "partly", text: "INDEX(range, MATCH(…), 0) returns the whole row (spills in Excel 365)" },
      XLOOKUP: { verdict: "yes", text: "Return a multi-column range; the result spills" },
    },
  },
  {
    topic: "Search from the bottom / last match",
    cells: {
      VLOOKUP: { verdict: "no", text: "Always the first match" },
      "INDEX-MATCH": { verdict: "no", text: "Always the first match (workaround: LOOKUP(2, 1/(…)))" },
      XLOOKUP: { verdict: "yes", text: "search_mode -1" },
    },
  },
  {
    topic: "Speed on large sheets",
    cells: {
      VLOOKUP: { verdict: "partly", text: "Fine for exact matches; a wide table reference recalculates when any column in it changes" },
      "INDEX-MATCH": { verdict: "yes", text: "Only depends on the two columns used; one MATCH can feed several INDEX formulas" },
      XLOOKUP: { verdict: "yes", text: "Comparable to INDEX-MATCH; binary search modes (2, -2) for sorted data" },
    },
  },
];

export function comparisonCsv(): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [["Topic", "VLOOKUP / HLOOKUP", "INDEX-MATCH", "XLOOKUP"].map(q).join(",")];
  for (const r of COMPARISON) lines.push([r.topic, r.cells.VLOOKUP.text, r.cells["INDEX-MATCH"].text, r.cells.XLOOKUP.text].map(q).join(","));
  return lines.join("\r\n") + "\r\n";
}
