import type { TlsCertInfo, TlsInspection, TlsVersion } from "@/lib/tools/tls-inspect";
import { normalizeHost } from "./host";
import { VERSIONS, type Check, type CertView, type Level, type SslResult } from "./types";

export type TlsFn = (host: string, opts?: { port?: number; timeoutMs?: number; version?: TlsVersion }) => Promise<TlsInspection>;

export interface Deps {
  tls: TlsFn;
  now?: () => Date;
}

export class CheckError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const DAY = 86_400_000;
const cn = (dn: string) => /(?:^|,\s*)CN=([^,]+)/.exec(dn)?.[1] ?? null;
const org = (dn: string) => /(?:^|,\s*)O=([^,]+)/.exec(dn)?.[1] ?? cn(dn);

/** Plain-language reason for Node's authorisation error codes. */
export function explainAuthError(code: string): { title: string; detail: string; kind: "expired" | "self_signed" | "untrusted_root" | "incomplete" | "mismatch" | "not_yet" | "revoked" | "other" } {
  switch (code) {
    case "CERT_HAS_EXPIRED":
      return { kind: "expired", title: "The certificate has expired", detail: "Browsers show a full-page warning. Renew the certificate and install the new one on the server." };
    case "DEPTH_ZERO_SELF_SIGNED_CERT":
      return { kind: "self_signed", title: "The certificate is self-signed", detail: "It was not issued by a certificate authority browsers trust, so visitors get a warning. Use a certificate from a public CA such as Let's Encrypt." };
    case "SELF_SIGNED_CERT_IN_CHAIN":
      return { kind: "untrusted_root", title: "The chain ends at an untrusted root", detail: "The root certificate is not in the trust stores browsers use; this is typical of private or corporate CAs." };
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
    case "UNABLE_TO_GET_ISSUER_CERT_LOCALLY":
    case "UNABLE_TO_GET_ISSUER_CERT":
      return { kind: "incomplete", title: "The chain is incomplete", detail: "The server does not send its intermediate certificate. Some browsers fetch it themselves, but many apps, older phones and API clients fail. Install the full chain (often called fullchain.pem)." };
    case "ERR_TLS_CERT_ALTNAME_INVALID":
      return { kind: "mismatch", title: "The certificate does not cover this name", detail: "Add the name to the certificate (as a Subject Alternative Name) or use a certificate issued for it." };
    case "CERT_NOT_YET_VALID":
      return { kind: "not_yet", title: "The certificate is not valid yet", detail: "Its start date is in the future. Check the server's clock, or wait until the start date." };
    case "CERT_REVOKED":
      return { kind: "revoked", title: "The certificate has been revoked", detail: "Its issuer has withdrawn it. Replace it now." };
    default:
      return { kind: "other", title: "The certificate is not trusted", detail: `The TLS library reported “${code}”.` };
  }
}

function view(c: TlsCertInfo, i: number, n: number, now: number): CertView {
  return {
    subject: c.subject,
    commonName: cn(c.subject),
    issuer: c.issuer,
    issuerName: org(c.issuer),
    validFrom: c.validFrom,
    validTo: c.validTo,
    daysLeft: Math.floor((Date.parse(c.validTo) - now) / DAY),
    san: c.san.slice(0, 200),
    serial: c.serial,
    fingerprint256: c.fingerprint256,
    keyType: c.keyType,
    keyBits: c.keyBits,
    isCa: c.isCa,
    selfSigned: c.selfSigned,
    role: i === 0 ? "leaf" : i === n - 1 && c.selfSigned ? "root" : "intermediate",
  };
}

const ERRORS: Record<string, string> = {
  invalid_host: "That host name or port cannot be checked.",
  blocked_host: "That address is on a private or reserved network, so the checker cannot reach it.",
  timeout: "The server did not answer within 10 seconds.",
  network: "Could not connect: the name may not exist, or nothing answers on that port.",
  handshake_failed: "The server accepted the connection but did not complete a TLS handshake. Is TLS enabled on this port?",
};

export async function run(input: { host: string; port?: number | null }, deps: Deps): Promise<SslResult> {
  const h = normalizeHost(input.host, input.port ?? null);
  if (!h.ok) throw new CheckError("invalid_input", h.error);
  const { host, port } = h;
  // One normal connection and four pinned to a single version: 5 connections, in parallel.
  const [main, ...probes] = await Promise.allSettled([deps.tls(host, { port, timeoutMs: 10_000 }), ...VERSIONS.map((version) => deps.tls(host, { port, timeoutMs: 10_000, version }))]);
  const versions = VERSIONS.map((version, i) => {
    const p = probes[i];
    if (p.status === "fulfilled") return { version, accepted: true, note: null };
    const code = (p.reason as { code?: string })?.code;
    return code === "handshake_failed" ? { version, accepted: false, note: null } : { version, accepted: null, note: code === "timeout" ? "no answer" : "could not test" };
  });
  let insp: TlsInspection;
  if (main.status === "fulfilled") insp = main.value;
  else {
    // If only an old protocol works, read the certificate from that connection.
    const ok = probes.find((p): p is PromiseFulfilledResult<TlsInspection> => p.status === "fulfilled");
    if (!ok) {
      const code = (main.reason as { code?: string })?.code ?? "network";
      throw new CheckError(code === "invalid_host" || code === "blocked_host" ? "invalid_input" : code, ERRORS[code] ?? ERRORS.network);
    }
    insp = ok.value;
  }
  const now = (deps.now?.() ?? new Date()).getTime();
  const chain = insp.chain.map((c, i) => view(c, i, insp.chain.length, now));
  const leaf = chain[0];
  const checks: Check[] = [];
  const auth = insp.authError ? explainAuthError(insp.authError) : null;

  if (leaf) {
    const d = leaf.daysLeft;
    const exp = new Date(leaf.validTo).toUTCString().slice(5, 16);
    if (d < 0) checks.push({ id: "expiry", level: "error", title: `Expired ${-d} day${d === -1 ? "" : "s"} ago`, detail: `The certificate ended on ${exp}. Renew it now.` });
    else if (d <= 7) checks.push({ id: "expiry", level: "error", title: `Expires in ${d} day${d === 1 ? "" : "s"}`, detail: `On ${exp}. Renew it today; check that automatic renewal is working.` });
    else if (d <= 14) checks.push({ id: "expiry", level: "warning", title: `Expires in ${d} days`, detail: `On ${exp}. Renew it this week.` });
    else if (d <= 30) checks.push({ id: "expiry", level: "warning", title: `Expires in ${d} days`, detail: `On ${exp}. Automatic renewal usually happens around now; make sure it does.` });
    else checks.push({ id: "expiry", level: "good", title: `Valid for ${d} more days`, detail: `Until ${exp}.` });
    if (Date.parse(leaf.validFrom) > now) checks.push({ id: "not_yet", level: "error", title: "Not valid yet", detail: `It starts on ${new Date(leaf.validFrom).toUTCString().slice(5, 16)}.` });
    checks.push(insp.hostnameMatches ? { id: "name", level: "good", title: `Covers ${host}`, detail: `The certificate lists ${leaf.san.length} name${leaf.san.length === 1 ? "" : "s"}.` } : { id: "name", level: "error", title: `Does not cover ${host}`, detail: `It is issued for ${leaf.san.slice(0, 5).map((s) => s.replace(/^DNS:/, "")).join(", ") || leaf.commonName || "other names"}. Visitors see a warning.` });
    const life = Math.round((Date.parse(leaf.validTo) - Date.parse(leaf.validFrom)) / DAY);
    if (life > 398) checks.push({ id: "lifetime", level: "info", title: `Valid for ${life} days in total`, detail: "Browsers have rejected newly issued public certificates valid for more than 398 days since September 2020; this one is either older or from a private CA." });
    if (leaf.keyType === "rsa" && leaf.keyBits !== null) checks.push(leaf.keyBits < 2048 ? { id: "key", level: "error", title: `Weak key: RSA ${leaf.keyBits} bits`, detail: "Use at least 2048 bits." } : { id: "key", level: "good", title: `RSA ${leaf.keyBits}-bit key`, detail: "Strong enough." });
    else if (leaf.keyType === "ec" && leaf.keyBits !== null) checks.push(leaf.keyBits < 256 ? { id: "key", level: "warning", title: `EC ${leaf.keyBits}-bit key`, detail: "Use P-256 or stronger." } : { id: "key", level: "good", title: `ECDSA ${leaf.keyBits}-bit key`, detail: "Strong and fast." });
    else if (leaf.keyType) checks.push({ id: "key", level: "good", title: `${leaf.keyType.toUpperCase()} key`, detail: "A modern key type." });
  }
  if (auth && auth.kind !== "mismatch" && auth.kind !== "expired") checks.push({ id: "chain", level: auth.kind === "untrusted_root" ? "warning" : "error", title: auth.title, detail: auth.detail });
  else if (auth?.kind === "expired" && !checks.some((c) => c.id === "expiry" && c.level === "error")) checks.push({ id: "chain", level: "error", title: auth.title, detail: auth.detail });
  else if (insp.authorized) checks.push({ id: "chain", level: "good", title: "The chain is complete and trusted", detail: `Issued by ${chain[0]?.issuerName ?? "a trusted CA"}.` });

  const accepts = (v: string) => versions.find((x) => x.version === v)?.accepted;
  const old = ["TLSv1", "TLSv1.1"].filter((v) => accepts(v));
  const label: Record<string, string> = { TLSv1: "TLS 1.0", "TLSv1.1": "TLS 1.1" };
  if (old.length) checks.push({ id: "old_tls", level: "warning", title: `Accepts ${old.map((v) => label[v]).join(" and ")}`, detail: "These versions were deprecated in 2021 (RFC 8996) and have known weaknesses. Turn them off; every current browser supports TLS 1.2." });
  else if (accepts("TLSv1") === false && accepts("TLSv1.1") === false) checks.push({ id: "old_tls", level: "good", title: "TLS 1.0 and 1.1 are refused", detail: "Only current protocol versions are accepted." });
  if (accepts("TLSv1.3") === false) checks.push({ id: "tls13", level: "info", title: "TLS 1.3 is not supported", detail: "TLS 1.3 makes connections faster and safer; most servers can enable it with a configuration change." });

  const rank: Level[] = ["error", "warning", "info", "good"];
  const level = rank.find((l) => checks.some((c) => c.level === l && l !== "info")) ?? "good";
  const days = leaf?.daysLeft ?? null;
  const first = checks.find((c) => c.level === "error") ?? checks.find((c) => c.level === "warning");
  const verdict = level === "good" ? { level, text: `The certificate is valid, trusted and covers ${host}. It expires in ${days} days.` } : { level, text: `${first?.title ?? "Problems found"}.` };
  return { host, port, ip: insp.ip, verdict, daysLeft: days, protocol: insp.protocol, cipher: insp.cipher, alpn: insp.alpn, versions, chain, checks, handshakeMs: insp.handshakeMs, checkedAt: new Date(now).toISOString() };
}
