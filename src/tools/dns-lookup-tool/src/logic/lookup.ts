import type { DnsResult, DnsType } from "@/lib/tools/dns-query";
import { normalizeDomain, registeredDomain } from "./domain";
import { lookupRegistration, type Fetcher } from "./rdap";
import { MAX_DNS_QUERIES, RECORD_TYPES, RESOLVER, type Finding, type LookupResult, type RecordRow, type RecordType, type TypeResult } from "./types";

export type DnsFn = (name: string, type: DnsType, opts?: { timeoutMs?: number }) => Promise<DnsResult>;

export interface Deps {
  fetcher: Fetcher;
  dns: DnsFn;
  now?: () => Date;
}

export class LookupError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const LOW_TTL = 60;
const HIGH_TTL = 2 * 86_400;

const row = (r: DnsResult["records"][number]): RecordRow => ({ name: r.name, type: r.type, ttl: r.ttl, data: r.data });

/** "10 mail.example.com" → mail.example.com */
const mxHost = (data: string) => data.trim().split(/\s+/)[1]?.replace(/\.$/, "").toLowerCase() ?? "";

export async function run(input: { domain: string; types?: RecordType[]; whois?: boolean }, deps: Deps): Promise<LookupResult> {
  const norm = normalizeDomain(input.domain);
  if (!norm.ok) throw new LookupError("invalid_input", norm.error);
  const domain = norm.domain;
  const types = input.types?.length ? RECORD_TYPES.filter((t) => input.types!.includes(t)) : [...RECORD_TYPES];
  let queries = 0;
  const query = async (name: string, type: DnsType): Promise<DnsResult | { error: string }> => {
    queries++;
    try {
      return await deps.dns(name, type, { timeoutMs: 5000 });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "invalid_name") throw new LookupError("invalid_input", "That name cannot be looked up in public DNS.");
      return { error: code === "timeout" ? "The DNS resolver did not answer in time." : "The DNS resolver could not be reached." };
    }
  };

  // CNAME is read from the A answer (its chain) when A is also asked, which saves a query for the MX check.
  const direct = types.filter((t) => !(t === "CNAME" && types.includes("A")));
  const answers = await Promise.all(direct.map((t) => query(domain, t)));
  const byType = new Map<RecordType, DnsResult | { error: string }>();
  direct.forEach((t, i) => byType.set(t, answers[i]));
  if (answers.every((a) => "error" in a)) throw new LookupError("upstream", (answers[0] as { error: string }).error);

  const aAnswer = byType.get("A");
  const chainSource = aAnswer && !("error" in aAnswer) ? aAnswer : null;
  const chain = (chainSource?.records ?? []).filter((r) => r.type === "CNAME").map(row);

  const results: TypeResult[] = types.map((t) => {
    if (t === "CNAME" && types.includes("A")) {
      return { type: t, status: chain.length ? "ok" : chainSource?.status === "nxdomain" ? "nxdomain" : "nodata", records: chain, dnssec: chainSource?.dnssec ?? false };
    }
    const a = byType.get(t)!;
    if ("error" in a) return { type: t, status: "error", records: [], dnssec: false };
    const records = a.records.filter((r) => r.type === t).map(row);
    return { type: t, status: records.length ? "ok" : a.status === "ok" ? "nodata" : a.status, records, dnssec: a.dnssec };
  });

  const findings: Finding[] = [];
  const get = (t: RecordType) => results.find((r) => r.type === t);
  const nx = results.some((r) => r.status === "nxdomain") && !results.some((r) => r.status === "ok");
  if (nx) findings.push({ level: "error", code: "nxdomain", message: `${domain} does not exist in DNS (NXDOMAIN). Check the spelling, or whether the domain has expired.` });

  // Dangling CNAME: the chain ends at a name that has no address.
  if (chain.length && chainSource && !chainSource.records.some((r) => r.type === "A") && (chainSource.status === "nxdomain" || chainSource.status === "nodata")) {
    const target = chain[chain.length - 1].data;
    findings.push({ level: "error", code: "dangling_cname", message: `Dangling CNAME: ${domain} points to ${target}, which ${chainSource.status === "nxdomain" ? "does not exist" : "has no address"}. Remove the CNAME or fix its target; a dangling CNAME can let someone else take over the name.` });
  }
  if (chain.length > 3) findings.push({ level: "warning", code: "long_chain", message: `The CNAME chain is ${chain.length} steps long. Each step is an extra lookup for visitors; point the name closer to its final target.` });

  const mx = get("MX");
  if (mx && !nx && mx.status !== "error") {
    const hosts = mx.records.map((r) => mxHost(r.data));
    if (mx.records.length === 0) findings.push({ level: "warning", code: "no_mx", message: "No MX record: other mail servers will try the domain's A record, and most will not deliver email to this domain. Add MX records if the domain should receive email." });
    else if (hosts.length === 1 && (hosts[0] === "" || hosts[0] === ".")) findings.push({ level: "info", code: "null_mx", message: "Null MX (0 .): the domain says it accepts no email at all." });
    else {
      // Remaining query budget checks the preferred MX hosts: an MX must not point to a CNAME (RFC 2181 §10.3).
      const sorted = [...mx.records].sort((a, b) => Number(a.data.split(/\s+/)[0]) - Number(b.data.split(/\s+/)[0])).map((r) => mxHost(r.data));
      const toCheck = [...new Set(sorted)].slice(0, Math.max(0, MAX_DNS_QUERIES - queries));
      const checks = await Promise.all(toCheck.map((h) => query(h, "A")));
      checks.forEach((c, i) => {
        if ("error" in c) return;
        if (c.records.some((r) => r.type === "CNAME" && r.name === toCheck[i])) findings.push({ level: "warning", code: "mx_cname", message: `The MX host ${toCheck[i]} is a CNAME. Mail servers expect MX targets to have their own A or AAAA records (RFC 2181); point the MX at the final host name.` });
        else if (c.status === "nxdomain") findings.push({ level: "error", code: "mx_missing", message: `The MX host ${toCheck[i]} does not exist, so email cannot be delivered to it.` });
      });
      if (toCheck.length < new Set(sorted).size) findings.push({ level: "info", code: "mx_partly_checked", message: `Only the first ${toCheck.length} MX host(s) were checked for CNAMEs, to stay within ${MAX_DNS_QUERIES} DNS queries per lookup.` });
    }
  }
  const ns = get("NS");
  if (ns && ns.status === "ok" && ns.records.length === 1) findings.push({ level: "warning", code: "single_ns", message: `Only one name server (${ns.records[0].data}). If it fails, the whole domain stops resolving; use at least two, on different networks.` });
  if (ns && ns.status === "nodata" && !nx && domain === registeredDomain(domain)) findings.push({ level: "warning", code: "no_ns", message: "No NS records were returned for this name." });
  const a = get("A");
  const aaaa = get("AAAA");
  if (a?.status === "ok" && aaaa && aaaa.status === "nodata") findings.push({ level: "info", code: "no_aaaa", message: "No AAAA (IPv6) record. Visitors on IPv6-only networks reach the site through translation; adding AAAA records is optional." });

  const all = results.flatMap((r) => r.records).concat(chain);
  const low = all.filter((r) => r.ttl > 0 && r.ttl < LOW_TTL);
  const high = all.filter((r) => r.ttl > HIGH_TTL);
  if (low.length) findings.push({ level: "info", code: "low_ttl", message: `${low.length} record(s) have a TTL under ${LOW_TTL} seconds (lowest ${Math.min(...low.map((r) => r.ttl))} s). That is fine during a migration, but it makes every visitor query the name servers far more often.` });
  if (high.length) findings.push({ level: "info", code: "high_ttl", message: `${high.length} record(s) have a TTL over 2 days (highest ${Math.round(Math.max(...high.map((r) => r.ttl)) / 3600)} h). Changes to them can take that long to reach everyone; lower the TTL a day before you change them.` });
  const txtLong = (get("TXT")?.records ?? []).filter((r) => r.data.length > 255);
  if (txtLong.length) findings.push({ level: "info", code: "long_txt", message: `${txtLong.length} TXT record(s) are longer than 255 characters. DNS stores them as several strings; they are shown here joined.` });
  if (get("CAA")?.status === "nodata") findings.push({ level: "info", code: "no_caa", message: "No CAA record: any certificate authority may issue certificates for this domain. A CAA record limits that to the ones you use." });
  if (results.some((r) => r.status === "error")) findings.push({ level: "warning", code: "partial", message: "Some record types could not be looked up because the resolver did not answer. The others are shown." });
  if (!findings.some((f) => f.level === "error" || f.level === "warning")) findings.unshift({ level: "good", code: "ok", message: "No misconfiguration found in the records that were checked." });

  const registration = input.whois === false ? null : await lookupRegistration(registeredDomain(domain), deps.fetcher, (deps.now?.() ?? new Date()).getTime());
  return {
    domain,
    input: input.domain.trim(),
    unicode: norm.unicode,
    results,
    chain,
    findings,
    registration,
    queries,
    resolver: RESOLVER,
    checkedAt: (deps.now?.() ?? new Date()).toISOString(),
  };
}
