import type { Zone } from "./mockDns";

/** Real RSA public keys (generated for these fixtures) so key sizes are read from actual DER data. */
export const KEY_2048 = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmOz4A/n0XyW/mqipKE8mOhTqFP4m8gjuBNudzXvYYc+Q2QpSr9fRH3LhBhKs66VhTvSktbzHOxImzpLdCed5Xv0E8bIkvwxGGGChg/Liwa1lXVkdUQI4yCE4tEmMUKVME2RKX/XFpA8HAuIjuFPn+eU8x8ksGDLUJBOFqclj2WWskFRrz3WW2nTPdYaK78BK+tqyn6izgaMG55LzQRdnH7ISPLvz1ENJnZVTQzzd2nfOd1NuLcDJaxtPJgqpfIZGB5zvHo9PBqK/lwKhY9rBh1DN7UO+OC579PJxh7h4DMQIvtnIzkY/6NcDIZ38fyHpeD680LFmVh0cPUyhkeUbYQIDAQAB";
export const KEY_1024 = "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCju90PUhSX6SwZ90zZDOEG1D/bCC1m87igg9ttNlUr2Aw543nMomrwHC1Hh9ej9y/6Z2bPzEZMLErx2+JdpfjlYcsTd9w11Rt3ks97bjMAyWLqKhqSNEeJEmppH7QqI2JJfHfQ5EOs0jfq23hCToTzmsT7A7AG2cPFzZzlTVDziwIDAQAB";
export const KEY_512 = "MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBALila8FuhBQ8m0TNAQJZeeIp9BpL3tlas31OdBr1yh4T2cKuUMR8DQRpYNfWZBi5RitVHb35SN2/ehy9WI0nZlUCAwEAAQ==";

/**
 * Invented zones under example.com (reserved for documentation). The main
 * domain is a typical small company: Google Workspace-like mail, a newsletter
 * service, DMARC still on p=none, MTA-STS in testing.
 */
export const ZONES: Zone = {
  "example.com": {
    TXT: [
      ["v=spf1 include:_spf.mail-host.example include:servers.newsletter.example ip4:192.0.2.0/24 ~all", 3600],
      ["google-site-verification=Zx81-ab", 3600],
    ],
    MX: [
      ["1 aspmx.mail-host.example", 3600],
      ["5 alt1.mail-host.example", 3600],
    ],
    A: [["192.0.2.10", 3600]],
  },
  "_spf.mail-host.example": { TXT: [["v=spf1 include:_netblocks.mail-host.example include:_netblocks2.mail-host.example ~all", 300]] },
  "_netblocks.mail-host.example": { TXT: [["v=spf1 ip4:198.51.100.0/24 ip4:203.0.113.0/24 ip6:2001:db8:4860::/48 ~all", 300]] },
  "_netblocks2.mail-host.example": { TXT: [["v=spf1 ip4:198.51.100.128/25 ~all", 300]] },
  "servers.newsletter.example": { TXT: [["v=spf1 ip4:203.0.113.200/29 a:mta.newsletter.example -all", 300]] },
  "mta.newsletter.example": { A: [["203.0.113.201", 300]] },
  "_dmarc.example.com": { TXT: [["v=DMARC1; p=none; pct=50; rua=mailto:dmarc@example.com,mailto:reports@dmarc-vendor.example; adkim=r; aspf=r", 3600]] },
  "google._domainkey.example.com": { TXT: [[`v=DKIM1; k=rsa; p=${KEY_2048}`, 3600]] },
  "selector1._domainkey.example.com": { CNAME: [["selector1-example-com._domainkey.mail-host.example", 3600]] },
  "selector1-example-com._domainkey.mail-host.example": { TXT: [[`v=DKIM1; k=rsa; t=y; p=${KEY_1024}`, 3600]] },
  "_mta-sts.example.com": { TXT: [["v=STSv1; id=20261028T0900", 3600]] },
  "default._bimi.example.com": { TXT: [["v=BIMI1; l=https://example.com/brand/logo.svg", 3600]] },

  // More than 10 lookups once nested includes are counted.
  "toomany.example.com": { TXT: [["v=spf1 include:a.senders.example include:b.senders.example include:c.senders.example mx a ptr ~all", 3600]], MX: [["10 mx.toomany.example.com", 3600]], A: [["192.0.2.50", 3600]] },
  "a.senders.example": { TXT: [["v=spf1 include:a1.senders.example include:a2.senders.example include:a3.senders.example ~all", 300]] },
  "a1.senders.example": { TXT: [["v=spf1 ip4:192.0.2.1 ~all", 300]] },
  "a2.senders.example": { TXT: [["v=spf1 ip4:192.0.2.2 ~all", 300]] },
  "a3.senders.example": { TXT: [["v=spf1 ip4:192.0.2.3 ~all", 300]] },
  "b.senders.example": { TXT: [["v=spf1 include:b1.senders.example include:b2.senders.example ~all", 300]] },
  "b1.senders.example": { TXT: [["v=spf1 ip4:192.0.2.4 ~all", 300]] },
  "b2.senders.example": { TXT: [["v=spf1 ip4:192.0.2.5 ~all", 300]] },
  "c.senders.example": { TXT: [["v=spf1 ip4:192.0.2.6 ~all", 300]] },

  // An include loop.
  "loop.example.com": { TXT: [["v=spf1 include:spf.loop-a.example -all", 3600]] },
  "spf.loop-a.example": { TXT: [["v=spf1 include:spf.loop-b.example ~all", 300]] },
  "spf.loop-b.example": { TXT: [["v=spf1 include:spf.loop-a.example ~all", 300]] },

  // Two SPF records, +all, a syntax error and a ptr.
  "multi.example.com": {
    TXT: [
      ["v=spf1 ip4:192.0.2.0/33 ptr +all", 3600],
      ["v=spf1 include:_spf.mail-host.example ~all", 3600],
    ],
  },
  "_dmarc.multi.example.com": { TXT: [["v=DMARC1; p=reject; rua=mailto:dmarc@multi.example.com", 3600]] },

  // Three void lookups and an include of a domain without SPF.
  "voids.example.com": { TXT: [["v=spf1 a:gone1.voids.example a:gone2.voids.example mx:gone3.voids.example include:nospf.voids.example ?all", 3600]] },
  "nospf.voids.example": { TXT: [["just some text", 300]] },
  "gone1.voids.example": "nxdomain",
  "gone2.voids.example": "nxdomain",
  "gone3.voids.example": "nxdomain",

  // A domain with no SPF, no DMARC.
  "bare.example.org": { A: [["192.0.2.90", 3600]] },
};

export const MTA_STS_POLICY = "version: STSv1\nmode: testing\nmx: aspmx.mail-host.example\nmax_age: 86400\n";
