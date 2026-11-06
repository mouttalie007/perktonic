import { MAX_MATCHES, type MatchInfo } from "./types";

export interface MatchResult {
  matches: MatchInfo[];
  /** True when MAX_MATCHES was reached and matching stopped. */
  capped: boolean;
  /** Text after replacement, when a replacement was given. */
  replaced: string | null;
}

/**
 * Runs the pattern over the text. Uses the d flag to get group positions, and
 * steps past empty matches so patterns like a* cannot loop forever. Meant to
 * run inside the worker, which the page terminates after the time limit.
 */
export function findMatches(source: string, flags: string, text: string, replacement: string | null): MatchResult {
  const withIndices = flags.includes("d") ? flags : `${flags}d`;
  const re = new RegExp(source, withIndices);
  const matches: MatchInfo[] = [];
  let capped = false;
  const global = flags.includes("g") || flags.includes("y");
  const collect = (m: RegExpExecArray) => {
    const indices = m.indices ?? [];
    matches.push({
      index: m.index,
      end: m.index + m[0].length,
      text: m[0],
      groups: m.slice(1).map((g, i) => (g === undefined ? null : { text: g, start: indices[i + 1]?.[0] ?? -1, end: indices[i + 1]?.[1] ?? -1 })),
      named: m.groups ? Object.fromEntries(Object.entries(m.groups).map(([k, v]) => [k, v ?? null])) : {},
    });
  };
  if (!global) {
    const m = re.exec(text);
    if (m) collect(m);
  } else {
    re.lastIndex = 0;
    for (;;) {
      const m = re.exec(text);
      if (!m) break;
      collect(m);
      if (m[0] === "") re.lastIndex = m.index + (flags.includes("u") || flags.includes("v") ? (text.codePointAt(m.index)! > 0xffff ? 2 : 1) : 1);
      if (matches.length >= MAX_MATCHES) {
        capped = true;
        break;
      }
    }
  }
  const replaced = replacement === null ? null : text.replace(new RegExp(source, flags), replacement);
  return { matches, capped, replaced };
}

/** Splits text into plain and matched pieces for highlighting, up to `limit` characters. */
export function segments(text: string, matches: MatchInfo[], limit: number): { text: string; match: number | null }[] {
  const out: { text: string; match: number | null }[] = [];
  let pos = 0;
  const end = Math.min(text.length, limit);
  for (let i = 0; i < matches.length && pos < end; i++) {
    const m = matches[i];
    if (m.index >= end) break;
    if (m.index > pos) out.push({ text: text.slice(pos, m.index), match: null });
    if (m.end > m.index) out.push({ text: text.slice(Math.max(m.index, pos), Math.min(m.end, end)), match: i });
    pos = Math.max(pos, Math.min(m.end, end));
  }
  if (pos < end) out.push({ text: text.slice(pos, end), match: null });
  return out;
}

export function matchesCsv(matches: MatchInfo[], groupNames: (string | null)[]): string {
  const q = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, "\"\"")}"` : s);
  // Formula guard: spreadsheet apps run cells starting with = + - @.
  const cell = (s: string) => q(/^[=+\-@]/.test(s) ? `'${s}` : s);
  const head = ["#", "start", "end", "match", ...groupNames.map((n, i) => (n ? `${i + 1}:${n}` : `group ${i + 1}`))];
  const rows = matches.map((m, k) => [String(k + 1), String(m.index), String(m.end), cell(m.text), ...m.groups.map((g) => (g ? cell(g.text) : ""))]);
  return "﻿" + [head.map(q), ...rows].map((r) => r.join(",")).join("\r\n") + "\r\n";
}
