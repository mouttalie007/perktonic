// No imports: shared by the page (browser) and the route (server).

export const PORTS = [443, 465, 993, 995, 8443] as const;
export const VERSIONS = ["TLSv1", "TLSv1.1", "TLSv1.2", "TLSv1.3"] as const;
export type Version = (typeof VERSIONS)[number];
export const RATE_LIMIT = { bucket: "ssl-certificate-checker", limit: 15, windowSec: 600 };
export const MAX_INPUT_LENGTH = 2048;

export type Level = "error" | "warning" | "info" | "good";
export interface Check {
  id: string;
  level: Level;
  title: string;
  detail: string;
}

export interface CertView {
  subject: string;
  commonName: string | null;
  issuer: string;
  issuerName: string | null;
  validFrom: string;
  validTo: string;
  daysLeft: number;
  san: string[];
  serial: string;
  fingerprint256: string;
  keyType: string | null;
  keyBits: number | null;
  isCa: boolean;
  selfSigned: boolean;
  /** "leaf", "intermediate" or "root". */
  role: "leaf" | "intermediate" | "root";
}

export interface SslResult {
  host: string;
  port: number;
  ip: string | null;
  verdict: { level: Level; text: string };
  daysLeft: number | null;
  protocol: string | null;
  cipher: string | null;
  alpn: string | null;
  versions: { version: Version; accepted: boolean | null; note: string | null }[];
  chain: CertView[];
  checks: Check[];
  handshakeMs: number | null;
  checkedAt: string;
}
