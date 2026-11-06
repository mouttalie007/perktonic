// No imports: shared by the page (browser) and the route (server).

export const MAX_INPUT_LENGTH = 2048;
export const RATE_LIMIT = { bucket: "spf-dkim-dmarc-checker", limit: 15, windowSec: 600 };
export const MAX_DNS_QUERIES = 40;
export const SPF_LOOKUP_LIMIT = 10;
export const SPF_VOID_LIMIT = 2;

/** Common DKIM selectors, probed when the visitor gives none. */
export const COMMON_SELECTORS = ["google", "selector1", "selector2", "default", "k1", "k2", "k3", "s1", "s2", "mail", "smtp", "dkim", "mandrill", "zoho", "pm", "mxvault", "sig1", "everlytickey1", "fm1", "protonmail"];

export type Level = "error" | "warning" | "info" | "good";
export interface Check {
  level: Level;
  message: string;
}

export interface SpfNode {
  domain: string;
  record: string | null;
  /** How this domain was reached: "include", "redirect" or the start. */
  via: "start" | "include" | "redirect";
  lookups: number;
  children: SpfNode[];
  problem: string | null;
}

export interface SpfReport {
  records: string[];
  record: string | null;
  checks: Check[];
  lookups: number;
  voidLookups: number;
  tree: SpfNode | null;
  all: string | null;
  suggestion: string | null;
}

export interface DmarcReport {
  record: string | null;
  /** Where the record was found: _dmarc.<domain> or the organisational domain. */
  foundAt: string | null;
  tags: Record<string, string>;
  checks: Check[];
  suggestion: string;
}

export interface DkimKey {
  selector: string;
  record: string;
  keyType: string;
  keyBits: number | null;
  testing: boolean;
  revoked: boolean;
}

export interface DkimReport {
  mode: "selector" | "probe";
  selectorsTried: string[];
  found: DkimKey[];
  checks: Check[];
}

export interface MtaStsReport {
  record: string | null;
  policyUrl: string;
  policy: { mode: string | null; mx: string[]; maxAge: number | null; version: string | null } | null;
  checks: Check[];
}

export interface BimiReport {
  record: string | null;
  checks: Check[];
}

export interface EmailAuthResult {
  domain: string;
  spf: SpfReport;
  dmarc: DmarcReport;
  dkim: DkimReport;
  mtaSts: MtaStsReport;
  bimi: BimiReport;
  queries: number;
  budgetReached: boolean;
  checkedAt: string;
}
