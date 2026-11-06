import { MAX_INPUT_LENGTH } from "./types";

export type DomainCheck = { ok: true; domain: string; unicode: string | null } | { ok: false; error: string };

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Accepts a domain, a URL or an email address and returns the domain in
 * lower-case punycode. IP addresses are refused: this tool looks up names.
 */
export function normalizeDomain(raw: string): DomainCheck {
  let v = raw.trim();
  if (v === "") return { ok: false, error: "Enter a domain name, for example example.com." };
  if (v.length > MAX_INPUT_LENGTH) return { ok: false, error: `The input is ${v.length} characters long; the limit is ${MAX_INPUT_LENGTH}.` };
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) {
    try {
      v = new URL(v).hostname;
    } catch {
      return { ok: false, error: "That does not look like a valid domain or URL." };
    }
  } else {
    v = v.replace(/^[^@\s]*@/, "").split(/[/?#]/)[0].replace(/:\d+$/, "");
  }
  v = v.replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (IPV4.test(v) || v.includes(":")) return { ok: false, error: "That is an IP address. This tool looks up domain names; enter a name such as example.com." };
  if (/\s/.test(v)) return { ok: false, error: "A domain name cannot contain spaces." };
  let ascii: string;
  try {
    // The URL parser applies IDNA, turning "bücher.de" into "xn--bcher-kva.de".
    ascii = new URL(`http://${v}/`).hostname;
  } catch {
    return { ok: false, error: "That domain contains characters that are not allowed." };
  }
  ascii = ascii.toLowerCase().replace(/\.$/, "");
  if (IPV4.test(ascii)) return { ok: false, error: "That is an IP address. This tool looks up domain names; enter a name such as example.com." };
  const labels = ascii.split(".");
  if (labels.length < 2) return { ok: false, error: "Enter a full domain name with an ending, such as example.com." };
  if (ascii.length > 253 || labels.some((l) => l.length === 0 || l.length > 63 || !/^[a-z0-9_]([a-z0-9-_]*[a-z0-9])?$/.test(l))) return { ok: false, error: "That is not a valid domain name: labels may use letters, digits and hyphens, up to 63 characters each." };
  if (!/^[a-z]{2,63}$|^xn--[a-z0-9-]+$/.test(labels[labels.length - 1])) return { ok: false, error: "The domain does not end in a valid top-level domain such as .com or .org." };
  if (/^(localhost|local|internal|lan|home|corp|test|invalid)$/.test(labels[labels.length - 1])) return { ok: false, error: "That is a private or reserved name, which public DNS does not answer." };
  const unicode = ascii.includes("xn--") ? toUnicode(ascii) : null;
  return { ok: true, domain: ascii, unicode };
}

/** Best-effort Unicode form for display; Punycode decoding per RFC 3492. */
export function toUnicode(ascii: string): string {
  return ascii
    .split(".")
    .map((l) => (l.startsWith("xn--") ? decodePunycode(l.slice(4)) ?? l : l))
    .join(".");
}

function decodePunycode(input: string): string | null {
  const base = 36;
  let n = 128;
  let i = 0;
  let bias = 72;
  const basic = input.lastIndexOf("-");
  const out = basic > 0 ? Array.from(input.slice(0, basic)) : [];
  let pos = basic > 0 ? basic + 1 : 0;
  while (pos < input.length) {
    const oldi = i;
    let w = 1;
    for (let k = base; ; k += base) {
      if (pos >= input.length) return null;
      const c = input.charCodeAt(pos++);
      const digit = c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : base;
      if (digit >= base) return null;
      i += digit * w;
      const t = k <= bias ? 1 : k >= bias + 26 ? 26 : k - bias;
      if (digit < t) break;
      w *= base - t;
    }
    const len = out.length + 1;
    let delta = oldi === 0 ? Math.floor((i - oldi) / 700) : (i - oldi) >> 1;
    delta += Math.floor(delta / len);
    let k = 0;
    while (delta > 455) {
      delta = Math.floor(delta / 35);
      k += base;
    }
    bias = k + Math.floor((36 * delta) / (delta + 38));
    n += Math.floor(i / len);
    i %= len;
    out.splice(i, 0, String.fromCodePoint(n));
    i++;
  }
  return out.join("");
}

/** Multi-label public suffixes where the registered domain has three labels (example.co.uk). */
const SECOND_LEVEL = new Set(["co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk", "ltd.uk", "plc.uk", "com.au", "net.au", "org.au", "edu.au", "co.nz", "org.nz", "co.jp", "ne.jp", "or.jp", "com.br", "net.br", "org.br", "co.za", "org.za", "co.in", "net.in", "org.in", "com.mx", "com.tr", "com.cn", "net.cn", "org.cn", "com.hk", "com.sg", "com.my", "co.id", "co.kr", "com.ar", "com.co", "co.il", "com.eg", "co.ma", "net.ma", "org.ma", "com.sa", "com.pl", "com.ua"]);

/** The registered domain for RDAP: www.shop.example.co.uk → example.co.uk. */
export function registeredDomain(domain: string): string {
  const labels = domain.split(".");
  const last2 = labels.slice(-2).join(".");
  return labels.slice(SECOND_LEVEL.has(last2) ? -3 : -2).join(".");
}
