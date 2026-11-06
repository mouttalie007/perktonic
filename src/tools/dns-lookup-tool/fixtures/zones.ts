import type { Zone } from "./mockDns";

const LONG_TXT = `google-site-verification=${"x".repeat(40)} ` + "v=DKIM1; k=rsa; p=" + "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA".padEnd(380, "A") + "IDAQAB";

/**
 * Invented zones under example.net / example.org (reserved for documentation),
 * built to show each warning the tool can give.
 */
export const ZONES: Zone = {
  "example.net": {
    A: [["93.184.215.14", 3600]],
    MX: [
      ["10 mx1.example.net", 3600],
      ["20 mx2.example.net", 3600],
    ],
    TXT: [
      ["v=spf1 include:_spf.mail-host.example ~all", 300],
      [LONG_TXT, 300],
      ["status-page-verification=a91f30", 30],
    ],
    NS: [
      ["ns1.dns-host.example", 86400],
      ["ns2.dns-host.example", 86400],
    ],
    SOA: [["ns1.dns-host.example hostmaster.example.net 2026103101 7200 3600 1209600 300", 3600]],
    CAA: [
      ['0 issue "letsencrypt.org"', 3600],
      ['0 iodef "mailto:security@example.net"', 3600],
    ],
  },
  "mx1.example.net": { CNAME: [["mail.mail-host.example", 3600]] },
  "mail.mail-host.example": { A: [["198.51.100.25", 3600]] },
  "mx2.example.net": { A: [["192.0.2.25", 3600]] },
  "www.example.net": { CNAME: [["example-net.cdn-host.example", 300]] },
  "example-net.cdn-host.example": { CNAME: [["edge-17.cdn-host.example", 60]] },
  "edge-17.cdn-host.example": { A: [["203.0.113.10", 20], ["203.0.113.11", 20]], AAAA: [["2001:db8::10", 20]] },
  "old.example.net": { CNAME: [["retired-app.paas-host.example", 3600]] },
  "retired-app.paas-host.example": "nxdomain",
  "example.org": {
    A: [["192.0.2.80", 604800]],
    NS: [["ns.single-host.example", 172800]],
    SOA: [["ns.single-host.example admin.example.org 1 3600 900 604800 86400", 86400]],
  },
  "xn--bcher-kva.example": {
    A: [["192.0.2.44", 3600]],
    AAAA: [["2001:db8::44", 3600]],
    MX: [["10 mx.xn--bcher-kva.example", 3600]],
    NS: [["a.ns.example", 3600], ["b.ns.example", 3600]],
  },
  "mx.xn--bcher-kva.example": { A: [["192.0.2.45", 3600]] },
};

export const DNSSEC_SIGNED = ["example.net"];
