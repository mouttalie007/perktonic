import type { SafeFetchOptions, SafeResponse } from "@/lib/tools/safe-fetch";
import { registeredDomain } from "./domain";
import type { Resolver } from "./resolver";
import { COMMON_SELECTORS, type BimiReport, type Check, type DkimKey, type DkimReport, type DmarcReport, type MtaStsReport } from "./types";

export type Fetcher = (url: string, opts?: SafeFetchOptions) => Promise<SafeResponse>;

/** "v=DMARC1; p=none; rua=mailto:x" → { v: "DMARC1", p: "none", rua: "mailto:x" } (keys lower-cased). */
export function parseTags(record: string): { tags: Record<string, string>; order: string[]; bad: string[] } {
  const tags: Record<string, string> = {};
  const order: string[] = [];
  const bad: string[] = [];
  for (const part of record.split(";")) {
    const p = part.trim();
    if (!p) continue;
    const m = /^([a-z][a-z0-9_]*)\s*=\s*([\s\S]*)$/i.exec(p);
    if (!m) {
      bad.push(p);
      continue;
    }
    const k = m[1].toLowerCase();
    if (!(k in tags)) order.push(k);
    tags[k] = m[2].trim();
  }
  return { tags, order, bad };
}

// ---------------------------------------------------------------- DMARC

const POLICIES = ["none", "quarantine", "reject"];

export async function checkDmarc(domain: string, res: Resolver): Promise<DmarcReport> {
  const checks: Check[] = [];
  const org = registeredDomain(domain);
  let foundAt: string | null = null;
  let records: string[] = [];
  for (const name of org !== domain ? [`_dmarc.${domain}`, `_dmarc.${org}`] : [`_dmarc.${domain}`]) {
    const a = await res.query(name, "TXT");
    records = (a?.values ?? []).filter((v) => /^v=DMARC1\s*(;|$)/i.test(v.trim()));
    if (records.length) {
      foundAt = name;
      break;
    }
  }
  const rua = `mailto:dmarc-reports@${org}`;
  if (records.length === 0) {
    checks.push({ level: "error", message: `No DMARC record at _dmarc.${domain}${org !== domain ? ` or _dmarc.${org}` : ""}. Without it, receivers have no policy for mail that fails SPF and DKIM, and you get no reports.` });
    return { record: null, foundAt: null, tags: {}, checks, suggestion: `v=DMARC1; p=none; rua=${rua}` };
  }
  if (records.length > 1) checks.push({ level: "error", message: `There are ${records.length} DMARC records at ${foundAt}; receivers ignore DMARC when there is more than one.` });
  if (foundAt !== `_dmarc.${domain}`) checks.push({ level: "info", message: `No record at _dmarc.${domain}, so receivers use the organisational domain's record at ${foundAt} (its sp= tag applies).` });
  const record = records[0];
  const { tags, order, bad } = parseTags(record);
  for (const b of bad) checks.push({ level: "error", message: `“${b}” is not a tag=value pair.` });
  if (order[0] !== "v") checks.push({ level: "error", message: "v=DMARC1 must be the first tag." });
  if (order[1] && order[1] !== "p" && foundAt === `_dmarc.${domain}`) checks.push({ level: "info", message: "p= should come right after v=DMARC1; some receivers are strict about the order." });
  const p = tags.p?.toLowerCase();
  if (!p) checks.push({ level: "error", message: "The required p= tag (policy) is missing, so the record is invalid." });
  else if (!POLICIES.includes(p)) checks.push({ level: "error", message: `p=${tags.p} is not valid; use none, quarantine or reject.` });
  else if (p === "none") checks.push({ level: "warning", message: "p=none only monitors: mail that fails DMARC is still delivered normally. Once the reports show your senders pass, move to quarantine, then reject." });
  else checks.push({ level: "good", message: `p=${p}: mail that fails DMARC is ${p === "reject" ? "rejected" : "sent to spam"}.` });
  if (tags.sp && !POLICIES.includes(tags.sp.toLowerCase())) checks.push({ level: "error", message: `sp=${tags.sp} is not valid; use none, quarantine or reject.` });
  else if (tags.sp?.toLowerCase() === "none" && p && p !== "none") checks.push({ level: "warning", message: "sp=none leaves subdomains unprotected while the main domain is protected." });
  if (tags.pct !== undefined) {
    const n = Number(tags.pct);
    if (!/^\d{1,3}$/.test(tags.pct) || n > 100) checks.push({ level: "error", message: `pct=${tags.pct} must be a whole number from 0 to 100.` });
    else if (n < 100) checks.push({ level: "warning", message: `pct=${n}: the policy applies to only ${n}% of failing mail; the rest is treated as p=none. Raise it to 100 when you are ready.` });
  }
  const uris = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
  for (const k of ["rua", "ruf"]) {
    if (!tags[k]) continue;
    for (const u of uris(tags[k])) if (!/^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}(!\d+[kmgt]?)?$/i.test(u)) checks.push({ level: "error", message: `${k}=${u} is not a valid mailto: address.` });
    const external = uris(tags[k]).map((u) => /@([^!]+)/.exec(u)?.[1]?.toLowerCase()).filter((d): d is string => !!d && registeredDomain(d) !== org);
    if (external.length) checks.push({ level: "info", message: `${k} sends reports to another domain (${[...new Set(external)].join(", ")}); that domain must publish a ${org}._report._dmarc record to accept them.` });
  }
  if (!tags.rua) checks.push({ level: "warning", message: "No rua= address, so you receive no aggregate reports and cannot see who sends mail as your domain." });
  if (tags.ruf) checks.push({ level: "info", message: "ruf= (failure reports) is set; many large mailbox providers never send them, so do not rely on it." });
  for (const k of ["adkim", "aspf"]) if (tags[k] && !/^[rs]$/i.test(tags[k])) checks.push({ level: "error", message: `${k}=${tags[k]} must be r (relaxed) or s (strict).` });
  if (tags.fo && !/^[01ds](:[01ds])*$/i.test(tags.fo)) checks.push({ level: "error", message: `fo=${tags.fo} must be 0, 1, d or s, separated by colons.` });
  if (tags.ri && !/^\d+$/.test(tags.ri)) checks.push({ level: "error", message: `ri=${tags.ri} must be a number of seconds.` });
  // Suggested record: keep what is valid, strengthen what is weak.
  const keepRua = tags.rua && uris(tags.rua).every((u) => /^mailto:/i.test(u)) ? tags.rua : rua;
  const parts = [`v=DMARC1`, `p=${p && POLICIES.includes(p) ? (p === "none" ? "quarantine" : p) : "none"}`];
  if (tags.sp && POLICIES.includes(tags.sp.toLowerCase()) && tags.sp.toLowerCase() !== "none") parts.push(`sp=${tags.sp.toLowerCase()}`);
  parts.push(`rua=${keepRua}`);
  if (tags.adkim && /^[rs]$/i.test(tags.adkim)) parts.push(`adkim=${tags.adkim.toLowerCase()}`);
  if (tags.aspf && /^[rs]$/i.test(tags.aspf)) parts.push(`aspf=${tags.aspf.toLowerCase()}`);
  return { record, foundAt, tags, checks, suggestion: parts.join("; ") };
}

// ---------------------------------------------------------------- DKIM

function derLength(b: Uint8Array, i: number): [number, number] {
  const first = b[i];
  if (first < 0x80) return [first, i + 1];
  const n = first & 0x7f;
  let len = 0;
  for (let k = 0; k < n; k++) len = len * 256 + b[i + 1 + k];
  return [len, i + 1 + n];
}

/** RSA modulus size in bits from a DKIM p= value (SubjectPublicKeyInfo, or a bare RSAPublicKey). */
export function rsaKeyBits(p: string): number | null {
  let bytes: Uint8Array;
  try {
    const bin = atob(p.replace(/\s/g, ""));
    bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  try {
    let i = 0;
    const expect = (tag: number) => {
      if (bytes[i] !== tag) throw new Error("der");
      const [len, next] = derLength(bytes, i + 1);
      i = next;
      return len;
    };
    expect(0x30);
    if (bytes[i] === 0x30) {
      // SubjectPublicKeyInfo: skip the algorithm, then open the BIT STRING.
      const algLen = expect(0x30);
      i += algLen;
      expect(0x03);
      i += 1;
      expect(0x30);
    }
    let modLen = expect(0x02);
    while (modLen > 0 && bytes[i] === 0) {
      i++;
      modLen--;
    }
    return modLen * 8 - (Math.clz32(bytes[i]) - 24);
  } catch {
    return null;
  }
}

export function parseDkim(selector: string, record: string): DkimKey | string {
  const { tags } = parseTags(record);
  if (tags.v && tags.v !== "DKIM1") return `v=${tags.v} is not DKIM1.`;
  if (!("p" in tags)) return "The record has no p= (public key) tag, so it is not a DKIM key.";
  const keyType = (tags.k ?? "rsa").toLowerCase();
  const revoked = tags.p === "";
  return {
    selector,
    record,
    keyType,
    keyBits: revoked ? null : keyType === "ed25519" ? 256 : rsaKeyBits(tags.p),
    testing: (tags.t ?? "").split(":").map((s) => s.trim()).includes("y"),
    revoked,
  };
}

export async function checkDkim(domain: string, selector: string | null, res: Resolver): Promise<DkimReport> {
  const selectors = selector ? [selector.toLowerCase()] : COMMON_SELECTORS;
  const answers = await Promise.all(selectors.map((s) => res.query(`${s}._domainkey.${domain}`, "TXT")));
  const found: DkimKey[] = [];
  const checks: Check[] = [];
  answers.forEach((a, i) => {
    const rec = (a?.values ?? []).find((v) => /(^|;)\s*(v=DKIM1|p=|k=)/i.test(v));
    if (!rec) return;
    const k = parseDkim(selectors[i], rec);
    if (typeof k === "string") checks.push({ level: "error", message: `Selector “${selectors[i]}”: ${k}` });
    else found.push(k);
  });
  for (const k of found) {
    const who = `Selector “${k.selector}”`;
    if (k.revoked) checks.push({ level: "warning", message: `${who}: the key is empty (p=), which means it was revoked. Mail signed with it fails DKIM.` });
    else if (k.keyType === "rsa" && k.keyBits !== null && k.keyBits < 1024) checks.push({ level: "error", message: `${who}: a ${k.keyBits}-bit RSA key is too weak; receivers ignore it. Use 2048 bits.` });
    else if (k.keyType === "rsa" && k.keyBits !== null && k.keyBits < 2048) checks.push({ level: "warning", message: `${who}: ${k.keyBits}-bit RSA key. It works, but 2048 bits is the current recommendation.` });
    else checks.push({ level: "good", message: `${who}: ${k.keyType === "ed25519" ? "Ed25519" : `${k.keyBits ?? "?"}-bit RSA`} key published.` });
    if (k.testing) checks.push({ level: "info", message: `${who}: t=y marks the key as in testing; some receivers treat its signatures as unsigned.` });
  }
  if (found.length === 0 && !checks.length) {
    if (selector) checks.push({ level: "error", message: `Selector not found: there is no DKIM record at ${selectors[0]}._domainkey.${domain}. Check the selector in the DKIM-Signature header (s=) of a message you sent.` });
    else checks.push({ level: "info", message: `None of ${selectors.length} common selectors has a DKIM key. That does not prove DKIM is missing: selectors can be any name. Open a message you sent, find “s=” in its DKIM-Signature header, and check that selector.` });
  }
  return { mode: selector ? "selector" : "probe", selectorsTried: selectors, found, checks };
}

// ---------------------------------------------------------------- MTA-STS

export function parsePolicy(text: string): MtaStsReport["policy"] {
  const lines = text.split(/\r?\n/).map((l) => /^([a-z_]+)\s*:\s*(.*)$/i.exec(l.trim())).filter((m): m is RegExpExecArray => !!m);
  const get = (k: string) => lines.filter((m) => m[1].toLowerCase() === k).map((m) => m[2].trim());
  const maxAge = get("max_age")[0];
  return { version: get("version")[0] ?? null, mode: get("mode")[0] ?? null, mx: get("mx"), maxAge: maxAge && /^\d+$/.test(maxAge) ? Number(maxAge) : null };
}

const mxMatches = (host: string, pattern: string) => (pattern.startsWith("*.") ? host.endsWith(pattern.slice(1)) && !host.slice(0, -pattern.length + 1).includes(".") : host === pattern.toLowerCase());

export async function checkMtaSts(domain: string, res: Resolver, fetcher: Fetcher): Promise<MtaStsReport> {
  const policyUrl = `https://mta-sts.${domain}/.well-known/mta-sts.txt`;
  const checks: Check[] = [];
  const a = await res.query(`_mta-sts.${domain}`, "TXT");
  const record = (a?.values ?? []).find((v) => /^v=STSv1/i.test(v.trim())) ?? null;
  if (!record) {
    checks.push({ level: "info", message: "No MTA-STS record (optional). MTA-STS tells other servers to deliver mail to you only over verified TLS." });
    return { record: null, policyUrl, policy: null, checks };
  }
  const { tags } = parseTags(record);
  if (!tags.id || !/^[a-z0-9]{1,32}$/i.test(tags.id)) checks.push({ level: "error", message: "The _mta-sts record needs an id= of 1 to 32 letters and digits; change it whenever the policy changes." });
  let policy: MtaStsReport["policy"] = null;
  try {
    const r = await fetcher(policyUrl, { maxBytes: 65536, timeoutMs: 8000 });
    if (r.status >= 300 && r.status < 400) checks.push({ level: "error", message: "The policy URL redirects; MTA-STS forbids redirects, so senders ignore the policy." });
    else if (r.status !== 200) checks.push({ level: "error", message: `The policy file answered HTTP ${r.status}; senders cannot use MTA-STS until ${policyUrl} returns the policy.` });
    else {
      policy = parsePolicy(new TextDecoder().decode(r.body));
      if (policy?.version !== "STSv1") checks.push({ level: "error", message: "The policy file must start with “version: STSv1”." });
      if (!policy?.mode || !["enforce", "testing", "none"].includes(policy.mode)) checks.push({ level: "error", message: "mode: must be enforce, testing or none." });
      else if (policy.mode === "testing") checks.push({ level: "info", message: "mode: testing — senders report problems but still deliver without TLS. Switch to enforce once reports are clean." });
      else if (policy.mode === "enforce") checks.push({ level: "good", message: "mode: enforce — senders deliver only over verified TLS to the listed MX hosts." });
      if (policy?.maxAge === null || policy?.maxAge === undefined) checks.push({ level: "error", message: "max_age: is missing or not a number of seconds." });
      else if (policy.maxAge > 31_557_600) checks.push({ level: "error", message: "max_age is above the maximum of 31557600 seconds (one year)." });
      else if (policy.maxAge < 86_400) checks.push({ level: "warning", message: `max_age is ${policy.maxAge} seconds; at least a week (604800) is recommended once the policy is stable.` });
      if (policy && policy.mx.length === 0 && policy.mode !== "none") checks.push({ level: "error", message: "The policy lists no mx: lines, so no mail server matches it." });
      const mx = await res.query(domain, "MX");
      const hosts = (mx?.values ?? []).map((v) => v.split(/\s+/)[1]?.replace(/\.$/, "").toLowerCase()).filter(Boolean);
      const unmatched = hosts.filter((h) => !policy!.mx.some((p) => mxMatches(h, p)));
      if (policy && policy.mx.length && unmatched.length) checks.push({ level: "error", message: `MX host(s) not covered by the policy: ${unmatched.join(", ")}. In enforce mode, senders will refuse to deliver to them.` });
    }
  } catch {
    checks.push({ level: "error", message: `The policy file at ${policyUrl} could not be fetched. Senders need it over HTTPS with a valid certificate.` });
  }
  return { record, policyUrl, policy, checks };
}

// ---------------------------------------------------------------- BIMI

export async function checkBimi(domain: string, res: Resolver, dmarcPolicy: string | null): Promise<BimiReport> {
  const a = await res.query(`default._bimi.${domain}`, "TXT");
  const record = (a?.values ?? []).find((v) => /^v=BIMI1/i.test(v.trim())) ?? null;
  const checks: Check[] = [];
  if (!record) {
    checks.push({ level: "info", message: "No BIMI record (optional). BIMI lets some mailboxes show your logo next to your messages." });
    return { record: null, checks };
  }
  const { tags, order } = parseTags(record);
  if (order[0] !== "v") checks.push({ level: "error", message: "v=BIMI1 must be the first tag." });
  if (!tags.l) checks.push({ level: "info", message: "l= is empty: the record says the domain has no logo (an opt-out)." });
  else if (!/^https:\/\/\S+\.svg(\?\S*)?$/i.test(tags.l)) checks.push({ level: "error", message: "l= must be an https:// address of an SVG file (SVG Tiny PS)." });
  else checks.push({ level: "good", message: "The logo address (l=) has the right form; this tool does not download or validate the SVG." });
  if (tags.a && !/^https:\/\/\S+$/i.test(tags.a)) checks.push({ level: "error", message: "a= must be the https:// address of a mark certificate (VMC or CMC)." });
  if (!tags.a) checks.push({ level: "info", message: "No a= certificate: several large mailbox providers show the logo only with a Verified Mark Certificate." });
  if (dmarcPolicy !== "quarantine" && dmarcPolicy !== "reject") checks.push({ level: "warning", message: "BIMI needs DMARC with p=quarantine or p=reject; with the current DMARC policy the logo is not shown." });
  return { record, checks };
}
