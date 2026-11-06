import type { FetchResult } from "./fetchHeaders";
import { checkCaching, checkCompression, checkCookies, checkDisclosure, parseCookies, type Cookie, type Note } from "./performance";
import { gradeSecurity, type SecurityReport } from "./security";
import { buildSnippet, type ServerKind } from "./snippets";

export interface HeaderRow {
  name: string;
  value: string;
}

export interface Analysis {
  security: SecurityReport;
  notes: Note[];
  cookies: Cookie[];
  /** Every header line in the order received; repeated headers (Set-Cookie) appear once per value. */
  rows: HeaderRow[];
  snippets: Record<ServerKind, string>;
}

export function analyze(r: FetchResult): Analysis {
  const security = gradeSecurity(r.headers, r.finalUrl);
  const cookies = parseCookies(r.headers, r.finalUrl.startsWith("https:"));
  const notes = [...checkCompression(r.headers, r.method), ...checkCaching(r.headers), ...checkCookies(cookies), ...checkDisclosure(r.headers)];
  const rows: HeaderRow[] = [];
  for (const name of Object.keys(r.headers).sort()) for (const value of r.headers[name]) rows.push({ name, value });
  const input = { checks: security.checks, notes };
  return {
    security,
    notes,
    cookies,
    rows,
    snippets: { nginx: buildSnippet("nginx", input), apache: buildSnippet("apache", input), caddy: buildSnippet("caddy", input) },
  };
}
