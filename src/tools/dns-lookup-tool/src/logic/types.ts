// No imports: shared by the page (browser) and the route (server).

export const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "CAA"] as const;
export type RecordType = (typeof RECORD_TYPES)[number];
export const RATE_LIMIT = { bucket: "dns-lookup-tool", limit: 20, windowSec: 600 };
export const MAX_DNS_QUERIES = 8;
export const MAX_INPUT_LENGTH = 2048;
export const RESOLVER = "Cloudflare (1.1.1.1, DNS over HTTPS)";

export type Level = "error" | "warning" | "info" | "good";

export interface Finding {
  level: Level;
  code: string;
  message: string;
}

export interface RecordRow {
  name: string;
  type: string;
  ttl: number;
  data: string;
}

export interface TypeResult {
  type: RecordType;
  status: "ok" | "nodata" | "nxdomain" | "servfail" | "error" | "skipped";
  /** Records of the asked type (the CNAME chain is in `chain`). */
  records: RecordRow[];
  dnssec: boolean;
}

export interface Registration {
  status: "ok" | "no_rdap" | "not_found" | "error";
  /** Why registration data is missing, in words. */
  message: string | null;
  server: string | null;
  domain: string | null;
  registrar: string | null;
  registrarIanaId: string | null;
  created: string | null;
  updated: string | null;
  expires: string | null;
  statuses: string[];
  nameservers: string[];
  dnssecSigned: boolean | null;
}

export interface LookupResult {
  domain: string;
  /** What the visitor typed, if it was converted (IDN → punycode, URL → host). */
  input: string;
  unicode: string | null;
  results: TypeResult[];
  /** CNAME chain from the name to its final target, in order. */
  chain: RecordRow[];
  findings: Finding[];
  registration: Registration | null;
  queries: number;
  resolver: string;
  checkedAt: string;
}
