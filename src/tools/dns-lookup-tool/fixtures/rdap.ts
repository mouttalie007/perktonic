import { SafeFetchError, type SafeFetchOptions, type SafeResponse } from "@/lib/tools/safe-fetch";

/** A trimmed IANA bootstrap file: .net and .org have a (fixture) RDAP server, .example has none. */
export const BOOTSTRAP = {
  version: "1.0",
  publication: "2026-10-01T00:00:00Z",
  services: [
    [["net", "com"], ["https://rdap.registry.example/v1/"]],
    [["org"], ["https://rdap.org-registry.example/rdap/"]],
  ],
};

/** An RDAP answer as registries send it, including a registrant contact that the tool must not show. */
export const EXAMPLE_NET_RDAP = {
  objectClassName: "domain",
  ldhName: "EXAMPLE.NET",
  status: ["client delete prohibited", "client transfer prohibited", "client update prohibited"],
  events: [
    { eventAction: "registration", eventDate: "1995-01-14T05:00:00Z" },
    { eventAction: "expiration", eventDate: "2027-01-13T05:00:00Z" },
    { eventAction: "last changed", eventDate: "2026-01-16T18:26:50Z" },
  ],
  nameservers: [{ ldhName: "NS1.DNS-HOST.EXAMPLE" }, { ldhName: "NS2.DNS-HOST.EXAMPLE" }],
  secureDNS: { delegationSigned: true },
  entities: [
    { objectClassName: "entity", roles: ["registrar"], publicIds: [{ type: "IANA Registrar ID", identifier: "9999" }], vcardArray: ["vcard", [["version", {}, "text", "4.0"], ["fn", {}, "text", "Example Registrar, Inc."]]] },
    { objectClassName: "entity", roles: ["registrant"], vcardArray: ["vcard", [["version", {}, "text", "4.0"], ["fn", {}, "text", "Jane Private Person"], ["email", {}, "text", "jane@private.example"]]] },
  ],
};

export interface FakeHttp {
  status: number;
  body?: unknown;
}

/** safeFetch stand-in that answers from a URL table and records the calls. */
export function mockFetcher(table: Record<string, FakeHttp | "network">) {
  const calls: string[] = [];
  const fetcher = async (url: string, opts: SafeFetchOptions = {}): Promise<SafeResponse> => {
    void opts;
    calls.push(url);
    const hit = table[url];
    if (!hit || hit === "network") throw new SafeFetchError("network", "Could not connect to that site.");
    const text = typeof hit.body === "string" ? hit.body : JSON.stringify(hit.body ?? {});
    return { url, status: hit.status, headers: { "content-type": ["application/rdap+json"] }, body: new TextEncoder().encode(text), truncated: false, timings: { dnsMs: null, connectMs: null, tlsMs: null, ttfbMs: 40, totalMs: 45 }, remoteIp: null };
  };
  return { fetcher, calls };
}

export const RDAP_TABLE = {
  "https://data.iana.org/rdap/dns.json": { status: 200, body: BOOTSTRAP },
  "https://rdap.registry.example/v1/domain/example.net": { status: 200, body: EXAMPLE_NET_RDAP },
  "https://rdap.org-registry.example/rdap/domain/example.org": { status: 404, body: { errorCode: 404, title: "Not Found" } },
};
