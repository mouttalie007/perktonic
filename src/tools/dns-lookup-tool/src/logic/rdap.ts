import type { SafeFetchOptions, SafeResponse } from "@/lib/tools/safe-fetch";
import type { Registration } from "./types";

export type Fetcher = (url: string, opts?: SafeFetchOptions) => Promise<SafeResponse>;

export const BOOTSTRAP_URL = "https://data.iana.org/rdap/dns.json";
const DAY_MS = 24 * 60 * 60 * 1000;

/** The IANA bootstrap file, kept in memory for 24 hours (one copy per server process). */
let cache: { at: number; services: Map<string, string> } | null = null;

export function clearBootstrapCache() {
  cache = null;
}

export function parseBootstrap(json: unknown): Map<string, string> {
  const map = new Map<string, string>();
  const services = (json as { services?: unknown })?.services;
  if (!Array.isArray(services)) throw new Error("bad bootstrap");
  for (const s of services) {
    if (!Array.isArray(s) || !Array.isArray(s[0]) || !Array.isArray(s[1])) continue;
    const url = (s[1] as unknown[]).find((u): u is string => typeof u === "string" && u.startsWith("https://")) ?? (s[1] as unknown[]).find((u): u is string => typeof u === "string");
    if (!url) continue;
    for (const tld of s[0] as unknown[]) if (typeof tld === "string") map.set(tld.toLowerCase(), url.endsWith("/") ? url : `${url}/`);
  }
  return map;
}

const json = (r: SafeResponse) => JSON.parse(new TextDecoder().decode(r.body)) as unknown;

async function bootstrap(fetcher: Fetcher, now: number): Promise<Map<string, string>> {
  if (cache && now - cache.at < DAY_MS) return cache.services;
  const r = await fetcher(BOOTSTRAP_URL, { headers: { accept: "application/json" }, maxBytes: 1_000_000 });
  if (r.status !== 200) throw new Error(`bootstrap ${r.status}`);
  const services = parseBootstrap(json(r));
  cache = { at: now, services };
  return services;
}

interface RdapEntity {
  roles?: string[];
  vcardArray?: [string, [string, unknown, string, unknown][]];
  publicIds?: { type?: string; identifier?: string }[];
  handle?: string;
}

const empty = (status: Registration["status"], message: string, server: string | null = null, domain: string | null = null): Registration => ({
  status,
  message,
  server,
  domain,
  registrar: null,
  registrarIanaId: null,
  created: null,
  updated: null,
  expires: null,
  statuses: [],
  nameservers: [],
  dnssecSigned: null,
});

/** Registrar, dates, statuses and name servers. Contact entities (registrant, admin, tech) are deliberately ignored. */
export function parseRdap(data: unknown, server: string): Registration {
  const d = data as { ldhName?: string; events?: { eventAction?: string; eventDate?: string }[]; status?: string[]; nameservers?: { ldhName?: string }[]; entities?: RdapEntity[]; secureDNS?: { delegationSigned?: boolean } };
  const event = (a: string) => d.events?.find((e) => e.eventAction === a)?.eventDate ?? null;
  const registrar = d.entities?.find((e) => e.roles?.includes("registrar"));
  const fn = registrar?.vcardArray?.[1]?.find((p) => p[0] === "fn")?.[3];
  return {
    status: "ok",
    message: null,
    server,
    domain: d.ldhName?.toLowerCase() ?? null,
    registrar: typeof fn === "string" ? fn : (registrar?.handle ?? null),
    registrarIanaId: registrar?.publicIds?.find((p) => /iana/i.test(p.type ?? ""))?.identifier ?? null,
    created: event("registration"),
    updated: event("last changed"),
    expires: event("expiration"),
    statuses: (d.status ?? []).filter((s): s is string => typeof s === "string").slice(0, 20),
    nameservers: (d.nameservers ?? []).map((n) => n.ldhName?.toLowerCase()).filter((n): n is string => !!n).slice(0, 20),
    dnssecSigned: typeof d.secureDNS?.delegationSigned === "boolean" ? d.secureDNS.delegationSigned : null,
  };
}

/** At most two requests: the bootstrap file (unless cached) and the registry's answer. */
export async function lookupRegistration(domain: string, fetcher: Fetcher, now: number): Promise<Registration> {
  const tld = domain.split(".").pop()!;
  let services: Map<string, string>;
  try {
    services = await bootstrap(fetcher, now);
  } catch {
    return empty("error", "The list of registration (RDAP) servers could not be loaded, so registration data is not shown.");
  }
  const base = services.get(tld);
  if (!base) return empty("no_rdap", `The .${tld} registry has no RDAP server listed by IANA, so registration data cannot be looked up here. The DNS records below are complete.`);
  const server = new URL(base).host;
  try {
    const r = await fetcher(`${base}domain/${domain}`, { headers: { accept: "application/rdap+json, application/json" }, maxBytes: 1_000_000 });
    if (r.status === 404) return empty("not_found", `The .${tld} registry has no registration for ${domain}. It may be unregistered, or a subdomain of another name.`, server, domain);
    if (r.status === 429) return empty("error", `The .${tld} registry is limiting requests right now; try again in a few minutes.`, server, domain);
    if (r.status >= 300 && r.status < 400) return empty("error", `The .${tld} registry answered with a redirect, which this tool does not follow.`, server, domain);
    if (r.status !== 200) return empty("error", `The .${tld} registry answered with HTTP ${r.status}.`, server, domain);
    return parseRdap(json(r), server);
  } catch {
    return empty("error", `The .${tld} registry did not answer properly, so registration data is not shown.`, server, domain);
  }
}
