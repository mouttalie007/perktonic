import type { DnsRecord, DnsResult, DnsType } from "@/lib/tools/dns-query";

/** A small zone file: name → type → [data, ttl][] (or "nxdomain" for the whole name). */
export type Zone = Record<string, Partial<Record<DnsType, [string, number][]>> | "nxdomain">;

/**
 * Answers like a recursive resolver from a fixture zone: follows CNAMEs (up to
 * 8 steps), returns nxdomain/nodata, and records every query for the tests.
 */
export function mockDns(zone: Zone, opts: { dnssec?: string[]; failTypes?: DnsType[] } = {}) {
  const calls: { name: string; type: DnsType }[] = [];
  const dns = async (name: string, type: DnsType): Promise<DnsResult> => {
    calls.push({ name, type });
    if (opts.failTypes?.includes(type)) throw Object.assign(new Error("timeout"), { code: "timeout" });
    const asked = name.toLowerCase().replace(/\.$/, "");
    const records: DnsRecord[] = [];
    let current = asked;
    for (let i = 0; i < 8; i++) {
      const node = zone[current];
      if (node === undefined || node === "nxdomain") return { name: asked, type, status: records.length ? "nxdomain" : "nxdomain", records, dnssec: false };
      const cname = node.CNAME?.[0];
      if (type !== "CNAME" && cname) {
        records.push({ name: current, type: "CNAME", ttl: cname[1], data: cname[0] });
        current = cname[0];
        continue;
      }
      for (const [data, ttl] of node[type] ?? []) records.push({ name: current, type, ttl, data });
      return { name: asked, type, status: records.some((r) => r.type === type) ? "ok" : "nodata", records, dnssec: opts.dnssec?.includes(asked) ?? false };
    }
    return { name: asked, type, status: "servfail", records, dnssec: false };
  };
  return { dns, calls };
}
