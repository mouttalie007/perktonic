import type { Resolver } from "./resolver";
import { SPF_LOOKUP_LIMIT, SPF_VOID_LIMIT, type Check, type SpfNode, type SpfReport } from "./types";

export interface Term {
  raw: string;
  kind: "mechanism" | "modifier" | "unknown";
  qualifier: "+" | "-" | "~" | "?";
  name: string;
  value: string | null;
}

const MECHANISMS = ["all", "include", "a", "mx", "ptr", "ip4", "ip6", "exists"];
const LOOKUP_TERMS = new Set(["include", "a", "mx", "ptr", "exists", "redirect"]);
const IPV4_CIDR = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}(\/([12]?\d|3[0-2]))?$/;
const IPV6_CIDR = /^[0-9a-f:.]+(\/(\d|[1-9]\d|1[01]\d|12[0-8]))?$/i;

export const isSpf = (txt: string) => /^v=spf1(\s|$)/i.test(txt.trim());

export function parseTerms(record: string): Term[] {
  return record
    .trim()
    .split(/\s+/)
    .slice(1)
    .filter(Boolean)
    .map((raw): Term => {
      const mod = /^([a-z][a-z0-9_.-]*)=(.*)$/i.exec(raw);
      if (mod) return { raw, kind: "modifier", qualifier: "+", name: mod[1].toLowerCase(), value: mod[2] };
      const m = /^([+\-~?]?)([a-z0-9]+)(?::(.*))?$/i.exec(raw);
      if (m && MECHANISMS.includes(m[2].toLowerCase())) {
        const value = m[3] ?? null;
        return { raw, kind: "mechanism", qualifier: ((m[1] || "+") as Term["qualifier"]), name: m[2].toLowerCase(), value };
      }
      const cidr = /^([+\-~?]?)(a|mx)(\/\d+(\/\/\d+)?)$/i.exec(raw);
      if (cidr) return { raw, kind: "mechanism", qualifier: ((cidr[1] || "+") as Term["qualifier"]), name: cidr[2].toLowerCase(), value: null };
      return { raw, kind: "unknown", qualifier: "+", name: raw, value: null };
    });
}

/** Syntax problems in one record, in plain words. */
export function syntaxProblems(terms: Term[]): string[] {
  const out: string[] = [];
  const mods = new Map<string, number>();
  for (const t of terms) {
    if (t.kind === "unknown") out.push(`“${t.raw}” is not a valid SPF mechanism or modifier.`);
    if (t.kind === "modifier") mods.set(t.name, (mods.get(t.name) ?? 0) + 1);
    if (t.kind !== "mechanism") continue;
    if ((t.name === "include" || t.name === "exists") && !t.value) out.push(`“${t.raw}” needs a domain after the colon.`);
    if (t.name === "ip4" && (!t.value || !IPV4_CIDR.test(t.value))) out.push(`“${t.raw}” is not a valid IPv4 address or range.`);
    if (t.name === "ip6" && (!t.value || !IPV6_CIDR.test(t.value) || !t.value.includes(":"))) out.push(`“${t.raw}” is not a valid IPv6 address or range.`);
    if (t.name === "all" && t.value) out.push(`“${t.raw}”: all takes no argument.`);
  }
  for (const [m, n] of mods) if ((m === "redirect" || m === "exp") && n > 1) out.push(`The ${m}= modifier appears ${n} times; it may appear once.`);
  const allIndex = terms.findIndex((t) => t.kind === "mechanism" && t.name === "all");
  if (allIndex >= 0 && allIndex < terms.length - 1 && terms.slice(allIndex + 1).some((t) => t.kind === "mechanism")) out.push("Mechanisms after “all” are never used: “all” matches every sender.");
  return out;
}

interface Walk {
  lookups: number;
  voids: number;
  problems: string[];
  ptr: boolean;
  capped: boolean;
}

const target = (t: Term, self: string) => (t.value ?? self).replace(/\/.*$/, "").toLowerCase();
const hasMacro = (s: string) => s.includes("%{");

async function walk(domain: string, via: SpfNode["via"], stack: string[], res: Resolver, w: Walk, reserve: number): Promise<SpfNode> {
  const node: SpfNode = { domain, record: null, via, lookups: 0, children: [], problem: null };
  if (stack.length > 10) {
    node.problem = "Recursion stopped after 10 levels.";
    w.capped = true;
    return node;
  }
  const txt = await res.query(domain, "TXT", reserve);
  if (!txt) {
    node.problem = "Not checked: the DNS query budget for this check was used up.";
    w.capped = true;
    return node;
  }
  const spf = txt.values.filter(isSpf);
  if (txt.status === "nxdomain" || txt.status === "nodata" || spf.length === 0) {
    node.problem = txt.status === "nxdomain" ? "This domain does not exist." : "This domain has no SPF record.";
    if (via !== "start") {
      w.voids += txt.status === "nxdomain" || txt.status === "nodata" ? 1 : 0;
      w.problems.push(`${via === "include" ? "include" : "redirect"}:${domain} points to a domain without an SPF record, which makes the whole SPF check fail (permerror).`);
    }
    return node;
  }
  if (spf.length > 1 && via !== "start") w.problems.push(`${domain} has ${spf.length} SPF records; receivers treat that as an error.`);
  node.record = spf[0];
  const terms = parseTerms(spf[0]);
  for (const t of terms) {
    const name = t.name;
    if (!LOOKUP_TERMS.has(name) || (t.kind === "modifier" && name !== "redirect")) continue;
    if (name === "redirect" && terms.some((x) => x.kind === "mechanism" && x.name === "all")) continue;
    node.lookups++;
    w.lookups++;
    if (name === "ptr") {
      w.ptr = true;
      continue;
    }
    const tgt = target(t, domain);
    if (hasMacro(tgt)) continue;
    if (name === "include" || name === "redirect") {
      if (stack.includes(tgt) || tgt === domain) {
        w.problems.push(`Loop: ${domain} ${name === "include" ? "includes" : "redirects to"} ${tgt}, which is already being evaluated.`);
        node.children.push({ domain: tgt, record: null, via: name === "include" ? "include" : "redirect", lookups: 0, children: [], problem: "Loop detected; not followed again." });
        continue;
      }
      node.children.push(await walk(tgt, name === "include" ? "include" : "redirect", [...stack, domain], res, w, reserve));
      continue;
    }
    // a, mx and exists: a lookup that returns nothing is a "void lookup" (RFC 7208 §4.6.4).
    const a = await res.query(tgt, name === "mx" ? "MX" : "A", reserve);
    if (!a) {
      w.capped = true;
      continue;
    }
    if (a.status === "nxdomain" || a.status === "nodata") w.voids++;
  }
  return node;
}

function suggest(records: string[], report: Omit<SpfReport, "suggestion">): string | null {
  if (records.length === 0) return "v=spf1 mx ~all";
  const terms = records.flatMap((r) => parseTerms(r)).filter((t) => t.kind !== "unknown");
  const seen = new Set<string>();
  const keep: string[] = [];
  let redirect: string | null = null;
  for (const t of terms) {
    if (t.kind === "modifier") {
      if (t.name === "redirect") redirect ??= t.raw;
      else if (!seen.has(t.raw)) keep.push(t.raw);
      seen.add(t.raw);
      continue;
    }
    // Invalid terms (a /33 range, a missing domain) are dropped rather than repeated.
    if (t.name === "ptr" || t.name === "all" || syntaxProblems([t]).length) continue;
    const key = t.raw.replace(/^\+/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keep.push(t.raw.replace(/^\+/, ""));
  }
  const all = report.all === "-all" ? "-all" : "~all";
  const out = ["v=spf1", ...keep, ...(redirect && !report.all ? [redirect] : [all])].join(" ");
  return out === records[0] ? null : out;
}

export async function checkSpf(domain: string, res: Resolver, reserve: number): Promise<SpfReport> {
  const txt = await res.query(domain, "TXT", reserve);
  const checks: Check[] = [];
  const records = (txt?.values ?? []).filter(isSpf);
  if (!txt || txt.status === "error") {
    return { records: [], record: null, checks: [{ level: "warning", message: "The TXT records could not be read, so SPF was not checked." }], lookups: 0, voidLookups: 0, tree: null, all: null, suggestion: null };
  }
  if (records.length === 0) {
    checks.push({ level: "error", message: "No SPF record. Receivers cannot tell which servers may send email for this domain, which makes spoofing easier and filtering stricter." });
    const r = { records, record: null, checks, lookups: 0, voidLookups: 0, tree: null, all: null };
    return { ...r, suggestion: suggest(records, r) };
  }
  if (records.length > 1) checks.push({ level: "error", message: `There are ${records.length} SPF records. A domain may publish only one; with two or more, receivers return “permerror” and SPF fails. Merge them into one record.` });
  const record = records[0];
  const terms = parseTerms(record);
  for (const p of syntaxProblems(terms)) checks.push({ level: "error", message: p });
  const w: Walk = { lookups: 0, voids: 0, problems: [], ptr: false, capped: false };
  const tree = await walk(domain, "start", [], res, w, reserve);
  for (const p of w.problems) checks.push({ level: "error", message: p });
  if (w.lookups > SPF_LOOKUP_LIMIT) checks.push({ level: "error", message: `${w.lookups} DNS lookups (include, a, mx, ptr, exists, redirect), counting every nested include. The limit is ${SPF_LOOKUP_LIMIT}: receivers stop and SPF fails (permerror). Remove senders you no longer use, or replace includes with ip4/ip6 ranges.` });
  else if (w.lookups >= 9) checks.push({ level: "warning", message: `${w.lookups} of ${SPF_LOOKUP_LIMIT} DNS lookups used. One more include will break SPF.` });
  else checks.push({ level: "good", message: `${w.lookups} of ${SPF_LOOKUP_LIMIT} DNS lookups used.` });
  if (w.voids > SPF_VOID_LIMIT) checks.push({ level: "error", message: `${w.voids} lookups returned nothing (void lookups). More than ${SPF_VOID_LIMIT} make SPF fail; remove mechanisms that point to names without records.` });
  else if (w.voids > 0) checks.push({ level: "warning", message: `${w.voids} lookup(s) returned nothing (void lookups); the limit is ${SPF_VOID_LIMIT}.` });
  if (w.ptr) checks.push({ level: "warning", message: "The ptr mechanism is deprecated (RFC 7208): it is slow and unreliable, and some receivers ignore it. Replace it with ip4/ip6 or include." });
  if (w.capped) checks.push({ level: "info", message: "Some nested records were not followed, to stay within the query budget of this check; the lookup count may be higher." });
  const allTerm = terms.find((t) => t.kind === "mechanism" && t.name === "all");
  const all = allTerm ? `${allTerm.qualifier}all` : null;
  if (all === "+all") checks.push({ level: "error", message: "+all lets every server in the world send as this domain. Use ~all or -all." });
  else if (all === "?all") checks.push({ level: "warning", message: "?all (neutral) gives receivers no guidance about unlisted senders. Use ~all, or -all once every sender is listed." });
  else if (all === "~all") checks.push({ level: "good", message: "~all: mail from servers not listed is marked as suspicious (softfail). Move to -all when you are sure every sender is listed." });
  else if (all === "-all") checks.push({ level: "good", message: "-all: mail from servers not listed should be rejected (hardfail)." });
  else if (!terms.some((t) => t.name === "redirect")) checks.push({ level: "warning", message: "The record has no “all” at the end, so unlisted senders get a neutral result. End it with ~all or -all." });
  if (record.length > 255) checks.push({ level: "info", message: `The record is ${record.length} characters long, so it is published as several strings; that is allowed, but keep it under about 450 characters to avoid DNS size problems.` });
  const base = { records, record, checks, lookups: w.lookups, voidLookups: w.voids, tree, all };
  return { ...base, suggestion: suggest(records, base) };
}
