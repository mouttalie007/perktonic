import type { Entity } from "./types";

const guard = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);
const q = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, "\"\"")}"` : s);

/** CSV with a BOM for Excel; cells that would start a formula get a leading apostrophe. */
export function entitiesCsv(list: Entity[]): string {
  const head = ["value", "normalized", "count", "first_position", "note", "context"];
  const rows = list.map((e) => [guard(e.value), guard(e.normalized), String(e.count), String(e.index), e.note ?? "", guard(e.context)].map(q).join(","));
  return "﻿" + [head.join(","), ...rows].join("\r\n") + "\r\n";
}

export function entitiesJson(category: string, list: Entity[]): string {
  return JSON.stringify({ category, count: list.length, items: list.map(({ value, normalized, count, index, note }) => ({ value, normalized, count, firstPosition: index, note })) }, null, 2);
}
