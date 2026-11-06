import type { ChainResult } from "./chain";
import { isWww, stripWww } from "./url";

export type Severity = "error" | "warning" | "info" | "good";

export interface Finding {
  severity: Severity;
  code: string;
  message: string;
}

export interface Analysis {
  findings: Finding[];
  /** One sentence telling the visitor what to change, or null when the chain is already ideal. */
  recommendation: string | null;
}

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2, good: 3 };

function host(url: string): string {
  return new URL(url).hostname.toLowerCase();
}

function scheme(url: string): string {
  return new URL(url).protocol;
}

/** Turns a followed chain into findings and a single recommendation (e.g. "collapse to a single 301"). */
export function analyzeChain(r: ChainResult): Analysis {
  const f: Finding[] = [];
  const redirects = r.hops.filter((h) => h.kind !== "none");
  const final = r.hops[r.hops.length - 1];
  const urls = r.hops.map((h) => h.url);
  if (r.stop?.url && r.stop.reason !== "error") urls.push(r.stop.url);

  if (r.stop?.reason === "loop") f.push({ severity: "error", code: "loop", message: `Redirect loop: ${r.stop.message} Browsers show “too many redirects” and search engines drop the URL.` });
  if (r.stop?.reason === "too_many_redirects") f.push({ severity: "error", code: "too_many", message: `More than ${10} redirects. Google follows at most 10 hops and browsers give up around 20; the chain must be shortened.` });
  if (r.stop?.reason === "error") f.push({ severity: "error", code: "hop_failed", message: `The chain broke at ${r.stop.url}: ${r.stop.message}` });

  if (r.stop === null) {
    if (final.status >= 400) f.push({ severity: "error", code: "final_error", message: `The chain ends in ${final.status} ${final.statusText}. Visitors and search engines land on an error page.` });
    else if (final.status >= 300) f.push({ severity: "warning", code: "final_3xx", message: `The last response is ${final.status} without a usable Location header.` });
    else if (redirects.length === 0) f.push({ severity: "good", code: "no_redirect", message: `No redirects: the URL answers ${final.status} ${final.statusText} directly.` });
  }

  if (redirects.length >= 2) {
    f.push({ severity: "warning", code: "chain", message: `A chain of ${redirects.length} redirects. Each hop adds a round trip (${redirects.reduce((s, h) => s + h.ms, 0)} ms here) and can lose link signals.` });
  } else if (redirects.length === 1 && redirects[0].kind === "permanent" && r.stop === null && final.status < 300) {
    f.push({ severity: "good", code: "single_permanent", message: `A single permanent redirect (${redirects[0].status}) straight to the final URL.` });
  }

  const kinds = new Set(redirects.map((h) => h.kind));
  const codes = [...new Set(redirects.map((h) => h.status))].sort();
  if (kinds.has("permanent") && kinds.has("temporary")) {
    f.push({ severity: "warning", code: "mixed", message: `Mixed redirect types (${codes.join(", ")}). Temporary hops tell search engines the move may be undone, which weakens the permanent ones.` });
  }
  for (const h of redirects) {
    if (h.status === 302 || h.status === 307) {
      f.push({ severity: "warning", code: "temporary", message: `Hop ${h.index} is a ${h.status} (temporary). If the move is permanent, use 301 (or 308 to keep the request method).` });
    } else if (h.status === 303) {
      f.push({ severity: "info", code: "see_other", message: `Hop ${h.index} is a 303 See Other, normally used after a form submission rather than for moved pages.` });
    }
    if (h.relativeLocation) f.push({ severity: "info", code: "relative", message: `Hop ${h.index} sends a relative Location (${h.locationRaw}). That is valid HTTP, but an absolute URL avoids mistakes with old clients and proxies.` });
  }

  // HTTP → HTTPS
  const schemes = urls.map(scheme);
  const downgrade = schemes.findIndex((s, i) => i > 0 && s === "http:" && schemes[i - 1] === "https:");
  if (downgrade > 0) {
    f.push({ severity: "error", code: "downgrade", message: `Hop ${downgrade} sends visitors from HTTPS back to HTTP (${urls[downgrade]}). This exposes them to interception and triggers browser warnings.` });
  }
  if (schemes[0] === "http:") {
    const firstHttps = schemes.indexOf("https:");
    if (firstHttps === -1) f.push({ severity: "warning", code: "no_https", message: "The site is not redirected to HTTPS. Add a 301 from http:// to https://." });
    else if (firstHttps === 1) f.push({ severity: "good", code: "https_first", message: "HTTP is upgraded to HTTPS in the first hop." });
    else f.push({ severity: "warning", code: "https_late", message: `HTTPS is only reached at hop ${firstHttps}. Upgrade to HTTPS in the very first redirect.` });
  }

  // www / non-www
  const hosts = urls.map(host);
  const wwwFlags = hosts.map(isWww);
  let toggles = 0;
  for (let i = 1; i < hosts.length; i++) if (stripWww(hosts[i]) === stripWww(hosts[i - 1]) && wwwFlags[i] !== wwwFlags[i - 1]) toggles++;
  if (toggles > 1) f.push({ severity: "warning", code: "www_flipflop", message: "The chain switches between www and non-www more than once. Pick one host and redirect to it directly." });
  const schemeHop = schemes.findIndex((s, i) => i > 0 && s !== schemes[i - 1]);
  const wwwHop = wwwFlags.findIndex((w, i) => i > 0 && w !== wwwFlags[i - 1] && stripWww(hosts[i]) === stripWww(hosts[i - 1]));
  if (schemeHop > 0 && wwwHop > 0 && schemeHop !== wwwHop) {
    f.push({ severity: "warning", code: "split_canonical", message: `HTTPS (hop ${schemeHop}) and the ${wwwFlags[wwwHop] ? "www" : "non-www"} host (hop ${wwwHop}) are fixed in separate hops. Do both in one redirect.` });
  }
  if (r.stop === null && stripWww(host(r.startUrl)) !== stripWww(host(final.url))) {
    f.push({ severity: "info", code: "cross_domain", message: `The chain ends on a different domain: ${host(final.url)}.` });
  }

  for (const c of r.clientRedirects) {
    const what = c.kind === "meta-refresh" ? `A meta refresh${c.delaySeconds !== null ? ` (after ${c.delaySeconds} s)` : ""}` : "A JavaScript redirect";
    f.push({ severity: "info", code: c.kind, message: `${what} on the final page points to ${c.target ?? "an unknown URL"}. It is not followed here; a server-side 301 is more reliable for search engines.` });
  }

  if (r.totalMs > 1000 && redirects.length > 0) f.push({ severity: "info", code: "slow", message: `The whole chain took ${r.totalMs} ms.` });

  f.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  let recommendation: string | null = null;
  if (r.stop?.reason === "loop") recommendation = "Fix the loop: make one of the URLs answer 200 instead of redirecting again.";
  else if (r.stop?.reason === "too_many_redirects") recommendation = `Replace the chain with a single 301 from ${r.startUrl} to the final destination.`;
  else if (r.stop === null && final.status < 300 && redirects.length > 0) {
    const needsWork = redirects.length >= 2 || redirects.some((h) => h.kind === "temporary") || downgrade > 0;
    if (needsWork) recommendation = `Collapse to a single 301: redirect ${r.startUrl} straight to ${final.url}.`;
  } else if (r.stop === null && final.status >= 400) {
    recommendation = "Point the redirect at a page that exists, or restore the missing page.";
  }
  return { findings: f, recommendation };
}
