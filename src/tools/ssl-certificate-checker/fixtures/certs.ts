import { TlsInspectError, type TlsCertInfo, type TlsInspection, type TlsVersion } from "@/lib/tools/tls-inspect";

/** The clock the fixtures are written against. */
export const NOW = new Date("2026-11-01T12:00:00Z");
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

const leaf = (over: Partial<TlsCertInfo> = {}): TlsCertInfo => ({
  subject: "CN=shop.example.com",
  issuer: "C=US, O=Let's Encrypt, CN=R11",
  validFrom: day(-36),
  validTo: day(54),
  san: ["DNS:shop.example.com", "DNS:www.shop.example.com"],
  serial: "04A1B2C3D4E5F60718293A4B5C6D7E8F9012",
  fingerprint256: "3F:9A:12:7C:44:B0:6E:21:9D:8B:51:0C:E2:73:AA:19:5F:60:C4:38:2B:97:DE:11:7A:05:C9:63:4E:88:F1:2D",
  keyType: "ec",
  keyBits: 256,
  isCa: false,
  selfSigned: false,
  ...over,
});
const intermediate: TlsCertInfo = { subject: "C=US, O=Let's Encrypt, CN=R11", issuer: "C=US, O=Internet Security Research Group, CN=ISRG Root X1", validFrom: "2024-03-13T00:00:00.000Z", validTo: "2027-03-12T23:59:59.000Z", san: [], serial: "8A7D3E13D62F30EF2386BD29076B34F8", fingerprint256: "59:1E:9C:E6:C8:63:D3:A0:79:E9:FA:BE:14:57:CB:E1:D6:2D:79:D5:F6:B0:E2:A8:9C:D2:72:4F:B6:76:C8:7C", keyType: "rsa", keyBits: 2048, isCa: true, selfSigned: false };
const root: TlsCertInfo = { subject: "C=US, O=Internet Security Research Group, CN=ISRG Root X1", issuer: "C=US, O=Internet Security Research Group, CN=ISRG Root X1", validFrom: "2015-06-04T11:04:38.000Z", validTo: "2035-06-04T11:04:38.000Z", san: [], serial: "8210CFB0D240E3594463E0BB63828B00", fingerprint256: "96:BC:EC:06:26:49:76:F3:74:60:77:9A:CF:28:C5:A7:CF:E8:A3:C0:AA:E1:1A:8F:FC:EE:05:C0:BD:DF:08:C6", keyType: "rsa", keyBits: 4096, isCa: true, selfSigned: true };

const inspection = (host: string, port: number, over: Partial<TlsInspection>): TlsInspection => ({
  host,
  port,
  ip: "203.0.113.20",
  protocol: "TLSv1.3",
  cipher: "TLS_AES_128_GCM_SHA256",
  alpn: "h2",
  authorized: true,
  authError: null,
  hostnameMatches: true,
  chain: [leaf(), intermediate, root],
  handshakeMs: 84,
  ...over,
});

interface Scenario {
  main: Partial<TlsInspection> | "handshake_failed" | "timeout" | "network";
  accepts: TlsVersion[];
}

/** Invented hosts under example.com, one per situation the checker must explain. */
export const SCENARIOS: Record<string, Scenario> = {
  "shop.example.com": { main: {}, accepts: ["TLSv1.2", "TLSv1.3"] },
  "expired.example.com": { main: { authorized: false, authError: "CERT_HAS_EXPIRED", chain: [leaf({ subject: "CN=expired.example.com", san: ["DNS:expired.example.com"], validFrom: day(-120), validTo: day(-30) }), intermediate, root] }, accepts: ["TLSv1.2", "TLSv1.3"] },
  "selfsigned.example.com": { main: { authorized: false, authError: "DEPTH_ZERO_SELF_SIGNED_CERT", chain: [leaf({ subject: "CN=selfsigned.example.com", issuer: "CN=selfsigned.example.com", san: ["DNS:selfsigned.example.com"], selfSigned: true, keyType: "rsa", keyBits: 2048, validFrom: day(-10), validTo: day(355 + 365 * 9) })] }, accepts: ["TLSv1.2"] },
  "mismatch.example.com": { main: { authorized: false, authError: "ERR_TLS_CERT_ALTNAME_INVALID", hostnameMatches: false }, accepts: ["TLSv1.2", "TLSv1.3"] },
  "incomplete.example.com": { main: { authorized: false, authError: "UNABLE_TO_VERIFY_LEAF_SIGNATURE", chain: [leaf({ subject: "CN=incomplete.example.com", san: ["DNS:incomplete.example.com"] })] }, accepts: ["TLSv1.2", "TLSv1.3"] },
  "legacy.example.com": { main: { protocol: "TLSv1.2", cipher: "ECDHE-RSA-AES128-SHA", alpn: "http/1.1", chain: [leaf({ subject: "CN=legacy.example.com", san: ["DNS:legacy.example.com"], validTo: day(10), keyType: "rsa", keyBits: 1024 }), intermediate, root] }, accepts: ["TLSv1", "TLSv1.1", "TLSv1.2"] },
  "tls10only.example.com": { main: "handshake_failed", accepts: ["TLSv1"] },
  "closed.example.com": { main: "network", accepts: [] },
};

/** tlsInspect stand-in; records each call so tests can count connections. */
export function mockTls(scenarios: Record<string, Scenario> = SCENARIOS) {
  const calls: { host: string; port?: number; version?: TlsVersion }[] = [];
  const tls = async (host: string, opts: { port?: number; version?: TlsVersion } = {}): Promise<TlsInspection> => {
    calls.push({ host, port: opts.port, version: opts.version });
    const s = scenarios[host];
    if (!s) throw new TlsInspectError("network", "getaddrinfo ENOTFOUND");
    if (opts.version) {
      if (!s.accepts.includes(opts.version)) throw new TlsInspectError(s.accepts.length ? "handshake_failed" : "network", "unsupported protocol");
      return inspection(host, opts.port ?? 443, { ...(typeof s.main === "object" ? s.main : {}), protocol: opts.version });
    }
    if (typeof s.main === "string") throw new TlsInspectError(s.main, s.main);
    return inspection(host, opts.port ?? 443, s.main);
  };
  return { tls, calls };
}
