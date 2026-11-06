import type { Delimiter } from "./csvParser";

export function quoteCell(value: string, delimiter: Delimiter): string {
  const needs = value.includes(delimiter) || value.includes("\"") || value.includes("\n") || value.includes("\r");
  return needs ? `"${value.replace(/"/g, "\"\"")}"` : value;
}

export function toCsv(header: string[] | null, rows: string[][], delimiter: Delimiter, lineEnding: "\n" | "\r\n" = "\r\n"): string {
  const lines: string[] = [];
  if (header) lines.push(header.map((c) => quoteCell(c, delimiter)).join(delimiter));
  for (const r of rows) lines.push(r.map((c) => quoteCell(c, delimiter)).join(delimiter));
  return lines.length === 0 ? "" : lines.join(lineEnding) + lineEnding;
}
