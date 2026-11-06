import { normalizeDomain } from "./domain";
import { checkBimi, checkDkim, checkDmarc, checkMtaSts, type Fetcher } from "./records";
import { Resolver, type DnsFn } from "./resolver";
import { checkSpf } from "./spf";
import { COMMON_SELECTORS, MAX_DNS_QUERIES, type EmailAuthResult } from "./types";

export interface Deps {
  fetcher: Fetcher;
  dns: DnsFn;
  now?: () => Date;
}

export class CheckError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function normalizeSelector(raw: string | undefined): { ok: true; selector: string | null } | { ok: false; error: string } {
  const s = (raw ?? "").trim().toLowerCase().replace(/\._domainkey.*$/, "");
  if (s === "") return { ok: true, selector: null };
  if (!/^[a-z0-9_-]+(\.[a-z0-9_-]+)*$/.test(s) || s.length > 63) return { ok: false, error: "A DKIM selector is a short name such as “google” or “selector1”, made of letters, digits, hyphens and dots." };
  return { ok: true, selector: s };
}

/**
 * Checks SPF, DMARC, DKIM, MTA-STS and BIMI with at most 40 DNS queries:
 * DKIM probing, DMARC, MTA-STS and BIMI have their queries reserved first, and
 * SPF's recursive walk gets what is left.
 */
export async function run(input: { domain: string; selector?: string }, deps: Deps): Promise<EmailAuthResult> {
  const norm = normalizeDomain(input.domain);
  if (!norm.ok) throw new CheckError("invalid_input", norm.error);
  const sel = normalizeSelector(input.selector);
  if (!sel.ok) throw new CheckError("invalid_input", sel.error);
  const domain = norm.domain;
  const res = new Resolver(deps.dns, MAX_DNS_QUERIES);
  const reserveForOthers = (sel.selector ? 1 : COMMON_SELECTORS.length) + 2 + 2 + 1;
  const spf = await checkSpf(domain, res, reserveForOthers);
  if (spf.records.length === 0 && spf.checks.some((c) => c.message.startsWith("The TXT records could not be read"))) {
    const probe = await res.query(domain, "A");
    if (probe?.status === "error") throw new CheckError("upstream", "The DNS resolver could not be reached. Please try again in a moment.");
  }
  const dmarc = await checkDmarc(domain, res);
  const [dkim, mtaSts] = await Promise.all([checkDkim(domain, sel.selector, res), checkMtaSts(domain, res, deps.fetcher)]);
  const bimi = await checkBimi(domain, res, dmarc.tags.p?.toLowerCase() ?? null);
  return { domain, spf, dmarc, dkim, mtaSts, bimi, queries: res.used, budgetReached: res.budgetReached, checkedAt: (deps.now?.() ?? new Date()).toISOString() };
}
