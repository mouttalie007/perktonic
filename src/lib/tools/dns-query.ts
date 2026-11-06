import { domainToASCII } from "node:url";
import net from "node:net";
import { safeFetch } from "./safe-fetch";

/**
 * DNS lookups for the tools. Questions go to a public resolver over HTTPS (DNS JSON
 * API, through safeFetch), so every record comes back with its TTL and the DNSSEC flag,
 * and the answers do not depend on the machine the site runs on. The visitor's domain
 * name is therefore sent to Cloudflare (1.1.1.1); tool pages say so.
 */
export type DnsType = "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS" | "SOA" | "CAA";
export type DnsStatus = "ok" | "nodata" | "nxdomain" | "servfail";

export interface DnsRecord {
  /** Owner name, lower case, without the trailing dot. */
  name: string;
  /** "OTHER" for a type the tools do not ask for (e.g. RRSIG in the middle of a chain). */
  type: DnsType | "OTHER";
  ttl: number;
  /** Text form: MX "10 mail.example.com", TXT = its strings joined, SOA "ns1 hostmaster serial refresh retry expire minimum", CAA `0 issue "letsencrypt.org"`. */
  data: string;
}

export interface DnsResult {
  name: string;
  type: DnsType;
  status: DnsStatus;
  /** Answer section in order, so a CNAME chain reads from first link to final records. */
  records: DnsRecord[];
  /** The resolver validated the answer with DNSSEC (AD bit). */
  dnssec: boolean;
}

export type DnsErrorCode = "invalid_name" | "timeout" | "network";

export class DnsQueryError extends Error {
  constructor(
    public code: DnsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DnsQueryError";
  }
}

const TYPE_NUMBER: Record<DnsType, number> = { A: 1, NS: 2, CNAME: 5, SOA: 6, MX: 15, TXT: 16, AAAA: 28, CAA: 257 };
const NUMBER_TYPE = new Map<number, DnsType>(Object.entries(TYPE_NUMBER).map(([k, v]) => [v, k as DnsType]));
const ENDPOINT = "https://cloudflare-dns.com/dns-query";

/** Lower-case ASCII (punycode) form of a domain name, or throws invalid_name. */
export function normalizeDnsName(raw: string): string {
  const trimmed = typeof raw === "string" ? raw.trim().replace(/\.$/, "") : "";
  const ascii = trimmed ? domainToASCII(trimmed.toLowerCase()) : "";
  const bad = (m: string) => new DnsQueryError("invalid_name", m);
  if (!ascii) throw bad("That does not look like a domain name.");
  if (net.isIP(ascii)) throw bad("Enter a domain name, not an IP address.");
  if (ascii.length > 253) throw bad("That domain name is too long.");
  const labels = ascii.split(".");
  // Underscore labels are legal here: _dmarc.example.com, selector._domainkey.example.com.
  if (!labels.every((l) => /^[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?$/.test(l))) throw bad("That does not look like a domain name.");
  if (labels.length < 2 || /^\d+$/.test(labels[labels.length - 1]!)) throw bad("Enter a full domain name such as example.com.");
  if (/\.(localhost|local|internal|invalid|onion|lan|home|corp)$/.test(ascii)) throw bad("That name is not a public domain.");
  return ascii;
}

/** RFC 3597 "\# 5 0005..." generic form → bytes, or null. */
function genericBytes(data: string): Buffer | null {
  const m = /^\\# (\d+)\s*([0-9a-fA-F\s]*)$/.exec(data);
  return m ? Buffer.from(m[2]!.replace(/\s+/g, ""), "hex") : null;
}

function formatData(type: DnsType | "OTHER", data: string): string {
  if (type === "TXT") {
    // "part one" "part two" → part onepart two (a TXT record is one string split into chunks)
    const parts = [...data.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]!.replace(/\\(.)/g, "$1"));
    return parts.length ? parts.join("") : data.replace(/^"|"$/g, "");
  }
  if (type === "CAA") {
    const raw = genericBytes(data);
    if (raw && raw.length >= 2) {
      const tagLen = raw[1]!;
      return `${raw[0]} ${raw.subarray(2, 2 + tagLen).toString("ascii")} "${raw.subarray(2 + tagLen).toString("utf8")}"`;
    }
    return data;
  }
  if (type === "MX" || type === "NS" || type === "CNAME" || type === "SOA") return data.replace(/\.(?=\s|$)/g, "");
  return data;
}

interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}
interface DohResponse {
  Status: number;
  AD?: boolean;
  Answer?: DohAnswer[];
}

/** Turns the resolver's JSON into a DnsResult. Pure, so it is tested without a network. */
export function parseDohResponse(name: string, type: DnsType, body: unknown): DnsResult {
  const j = body as DohResponse;
  if (!j || typeof j.Status !== "number") throw new DnsQueryError("network", "The DNS resolver sent an answer we could not read.");
  const status: DnsStatus = j.Status === 3 ? "nxdomain" : j.Status !== 0 ? "servfail" : "ok";
  const records: DnsRecord[] = (j.Answer ?? []).slice(0, 200).map((a) => {
    const t = NUMBER_TYPE.get(a.type) ?? "OTHER";
    return { name: String(a.name).replace(/\.$/, "").toLowerCase(), type: t, ttl: Math.max(0, Math.floor(Number(a.TTL) || 0)), data: formatData(t, String(a.data)) };
  });
  const answered = records.some((r) => r.type === type || r.type === "CNAME");
  return { name, type, status: status === "ok" && !answered ? "nodata" : status, records, dnssec: j.AD === true };
}

export async function dnsQuery(name: string, type: DnsType, opts: { timeoutMs?: number } = {}): Promise<DnsResult> {
  const ascii = normalizeDnsName(name);
  const url = `${ENDPOINT}?name=${encodeURIComponent(ascii)}&type=${type}`;
  try {
    const res = await safeFetch(url, { timeoutMs: opts.timeoutMs ?? 5000, maxBytes: 200_000, headers: { accept: "application/dns-json" } });
    if (res.status !== 200) throw new DnsQueryError("network", "The DNS resolver did not answer. Please try again.");
    return parseDohResponse(ascii, type, JSON.parse(Buffer.from(res.body).toString("utf8")));
  } catch (e) {
    if (e instanceof DnsQueryError) throw e;
    const code = (e as { code?: string }).code;
    if (code === "timeout") throw new DnsQueryError("timeout", "The DNS resolver took too long to answer.");
    throw new DnsQueryError("network", "The DNS resolver could not be reached. Please try again.");
  }
}
