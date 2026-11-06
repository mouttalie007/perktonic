import { MAX_PEOPLE, parseHm, type Person, type Plan } from "./overlap";

const VERSION = "1";

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/**
 * Packs the plan into the URL fragment (#plan=…). Browsers never send the
 * fragment to the server, so names and zones stay between the people who
 * share the link.
 */
export function encodePlan(plan: Plan): string {
  const compact = {
    v: VERSION,
    d: plan.date,
    z: plan.viewZone,
    m: plan.minMinutes,
    p: plan.people.map((p) => [p.name, p.zone, p.start, p.end, p.days.join("")]),
  };
  return `plan=${toBase64Url(new TextEncoder().encode(JSON.stringify(compact)))}`;
}

export type DecodeResult = { ok: true; plan: Plan } | { ok: false; error: string };

/** Reads a fragment back, checking every field, because anyone can edit a URL. */
export function decodePlan(fragment: string, isZone: (z: string) => boolean): DecodeResult {
  const m = /(?:^#?|&)plan=([A-Za-z0-9_-]{1,20000})(?:&|$)/.exec(fragment);
  if (!m) return { ok: false, error: "This link does not contain a plan." };
  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder().decode(fromBase64Url(m[1])));
  } catch {
    return { ok: false, error: "This shared link is damaged; ask for a new one." };
  }
  const o = data as { v?: unknown; d?: unknown; z?: unknown; m?: unknown; p?: unknown };
  if (o.v !== VERSION || typeof o.d !== "string" || typeof o.z !== "string" || !Array.isArray(o.p)) return { ok: false, error: "This shared link is from an unknown version of the planner." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.d) || !isZone(o.z)) return { ok: false, error: "The date or time zone in this link is not valid." };
  if (o.p.length > MAX_PEOPLE) return { ok: false, error: `The link has more than ${MAX_PEOPLE} people.` };
  const people: Person[] = [];
  for (const row of o.p) {
    if (!Array.isArray(row) || row.length !== 5 || !row.every((x) => typeof x === "string")) return { ok: false, error: "A person in this link is not valid." };
    const [name, zone, start, end, days] = row as string[];
    if (!isZone(zone) || parseHm(start) === null || parseHm(end) === null || !/^[0-6]{0,7}$/.test(days)) return { ok: false, error: `The entry for ${name.slice(0, 40) || "a person"} is not valid.` };
    people.push({ name: name.slice(0, 40), zone, start, end, days: [...new Set(days.split("").map(Number))].sort() });
  }
  const minMinutes = typeof o.m === "number" && [15, 30, 45, 60, 90, 120].includes(o.m) ? o.m : 30;
  return { ok: true, plan: { people, date: o.d, viewZone: o.z, minMinutes } };
}
