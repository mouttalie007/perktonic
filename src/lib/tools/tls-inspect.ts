import { X509Certificate } from "node:crypto";
import net from "node:net";
import tls from "node:tls";
import { domainToASCII } from "node:url";
import { guardedLookup, isBlockedAddress } from "./safe-fetch";

/**
 * Reads the TLS certificate chain and the negotiated protocol of a public host, for
 * the certificate-checker tool. One connection per call (so a tool that probes TLS 1.0,
 * 1.1, 1.2 and 1.3 makes four calls), made with the same address policy as safeFetch:
 * public addresses only, checked after DNS resolution. Certificates that fail
 * verification are still read (that is the point of a checker); the verdict is in
 * `authorized` / `authError` / `hostnameMatches`.
 */
export type TlsVersion = "TLSv1" | "TLSv1.1" | "TLSv1.2" | "TLSv1.3";
/** Plain-TLS ports a visitor may test. */
export const TLS_PORTS = [443, 465, 993, 995, 8443] as const;

export interface TlsCertInfo {
  subject: string;
  issuer: string;
  /** ISO 8601 */
  validFrom: string;
  validTo: string;
  /** Subject alternative names, e.g. "DNS:example.com", "IP:203.0.113.5". */
  san: string[];
  serial: string;
  fingerprint256: string;
  keyType: string | null;
  keyBits: number | null;
  isCa: boolean;
  selfSigned: boolean;
}

export interface TlsInspection {
  host: string;
  port: number;
  ip: string | null;
  /** Negotiated version, e.g. "TLSv1.3". */
  protocol: string | null;
  cipher: string | null;
  alpn: string | null;
  /** Node accepted the chain against its trusted roots. */
  authorized: boolean;
  /** Node's reason when not authorized, e.g. "CERT_HAS_EXPIRED", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" (incomplete chain), "DEPTH_ZERO_SELF_SIGNED_CERT". */
  authError: string | null;
  /** The leaf certificate covers `host` (name check as a browser does it). */
  hostnameMatches: boolean;
  /** Leaf first, then each certificate the chain led to. */
  chain: TlsCertInfo[];
  handshakeMs: number;
}

export interface TlsInspectOptions {
  port?: number;
  timeoutMs?: number;
  /** Pin one protocol version to test whether the server accepts it (minVersion = maxVersion). Versions below 1.2 are allowed for the probe only. */
  version?: TlsVersion;
}

export type TlsErrorCode = "invalid_host" | "blocked_host" | "timeout" | "network" | "handshake_failed";

export class TlsInspectError extends Error {
  constructor(
    public code: TlsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TlsInspectError";
  }
}

export function normalizeHost(raw: string): string {
  const ascii = typeof raw === "string" ? domainToASCII(raw.trim().toLowerCase().replace(/\.$/, "")) : "";
  if (!ascii || ascii.length > 253 || !/^[a-z0-9_]([a-z0-9_.-]*[a-z0-9_])?$/.test(ascii)) throw new TlsInspectError("invalid_host", "That does not look like a domain name.");
  if (/(^|\.)(localhost)$|\.(local|internal|invalid|lan|home|corp)$/.test(ascii)) throw new TlsInspectError("blocked_host", "That address is private and cannot be checked.");
  if (net.isIP(ascii) && isBlockedAddress(ascii)) throw new TlsInspectError("blocked_host", "That address is private and cannot be checked.");
  return ascii;
}

function describe(x: X509Certificate): TlsCertInfo {
  const key = x.publicKey;
  const details = key.asymmetricKeyDetails as { modulusLength?: number; namedCurve?: string } | undefined;
  const bits = details?.modulusLength ?? ({ "P-256": 256, prime256v1: 256, "P-384": 384, secp384r1: 384, "P-521": 521, secp521r1: 521 } as Record<string, number>)[details?.namedCurve ?? ""] ?? null;
  return {
    subject: x.subject.replace(/\n/g, ", "),
    issuer: x.issuer.replace(/\n/g, ", "),
    validFrom: new Date(x.validFrom).toISOString(),
    validTo: new Date(x.validTo).toISOString(),
    san: x.subjectAltName ? x.subjectAltName.split(/,\s*/).slice(0, 200) : [],
    serial: x.serialNumber,
    fingerprint256: x.fingerprint256,
    keyType: key.asymmetricKeyType ?? null,
    keyBits: bits,
    isCa: x.ca,
    selfSigned: x.subject === x.issuer && x.verify(key),
  };
}

export async function tlsInspect(rawHost: string, opts: TlsInspectOptions = {}): Promise<TlsInspection> {
  const host = normalizeHost(rawHost);
  const port = opts.port ?? 443;
  if (!(TLS_PORTS as readonly number[]).includes(port)) throw new TlsInspectError("blocked_host", `Only these ports can be checked: ${TLS_PORTS.join(", ")}.`);
  const timeoutMs = opts.timeoutMs ?? 8000;

  return new Promise<TlsInspection>((resolve, reject) => {
    const t0 = performance.now();
    let connected = false;
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const fail = (code: TlsErrorCode, message: string) =>
      finish(() => {
        socket.destroy();
        reject(new TlsInspectError(code, message));
      });
    const timer = setTimeout(() => fail("timeout", "The server did not answer in time."), timeoutMs);

    const socket = tls.connect({
      host,
      port,
      servername: net.isIP(host) ? undefined : host,
      lookup: guardedLookup,
      rejectUnauthorized: false,
      ALPNProtocols: ["h2", "http/1.1"],
      ...(opts.version ? { minVersion: opts.version, maxVersion: opts.version, ciphers: opts.version === "TLSv1.3" ? undefined : "ALL:@SECLEVEL=0" } : {}),
    });
    socket.once("connect", () => (connected = true));
    socket.once("error", (e: NodeJS.ErrnoException) => {
      if (e.code === "EBLOCKED") return fail("blocked_host", "That address is private and cannot be checked.");
      if (e.code === "ENOTFOUND" || e.code === "EAI_AGAIN") return fail("network", "That domain name does not exist or has no address.");
      if (connected) return fail("handshake_failed", "The server did not complete a TLS handshake.");
      fail("network", "Could not connect to that server.");
    });
    socket.once("secureConnect", () => {
      finish(() => {
        const ip = socket.remoteAddress ?? null;
        if (ip && isBlockedAddress(ip)) {
          socket.destroy();
          return reject(new TlsInspectError("blocked_host", "That address is private and cannot be checked."));
        }
        try {
          const leaf = socket.getPeerCertificate(true);
          const chain: TlsCertInfo[] = [];
          const seen = new Set<string>();
          for (let c: tls.DetailedPeerCertificate | undefined = leaf; c && c.raw && !seen.has(c.fingerprint256) && chain.length < 10; c = c.issuerCertificate) {
            seen.add(c.fingerprint256);
            chain.push(describe(new X509Certificate(c.raw)));
          }
          const identity = leaf?.raw ? tls.checkServerIdentity(host, leaf) : new Error("no certificate");
          const result: TlsInspection = {
            host,
            port,
            ip,
            protocol: socket.getProtocol(),
            cipher: socket.getCipher()?.name ?? null,
            alpn: typeof socket.alpnProtocol === "string" ? socket.alpnProtocol : null,
            authorized: socket.authorized,
            authError: socket.authorized ? null : String(socket.authorizationError ?? "UNKNOWN"),
            hostnameMatches: !identity,
            chain,
            handshakeMs: Math.round(performance.now() - t0),
          };
          socket.destroy();
          resolve(result);
        } catch {
          socket.destroy();
          reject(new TlsInspectError("handshake_failed", "The server's certificate could not be read."));
        }
      });
    });
  });
}
