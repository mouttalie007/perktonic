import type { Node } from "./parser";

export interface MaskCounts {
  tokens: number;
  emails: number;
  cards: number;
}

/**
 * Keys whose string values are secrets whatever they look like. Matched against
 * the whole key or its last _/- separated part, so "author" or "tokens_used" are not hit.
 */
const SECRET_KEY = /^(?:.*[_-])?(?:token|secret|password|passwd|pwd|apikey|api[_-]?key|authorization|signature|private[_-]?key|client[_-]?secret|access[_-]?key|refresh[_-]?token|cookie)$/i;

/** Credentials recognisable by their shape, wherever they appear inside a string. */
const TOKEN_PATTERNS: { re: RegExp; keep: number }[] = [
  { re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{8,}/g, keep: 8 }, // Stripe secret and restricted keys
  { re: /\bwhsec_[A-Za-z0-9]{8,}/g, keep: 6 }, // Stripe webhook signing secret
  { re: /\b(?:pi|seti)_[A-Za-z0-9]+_secret_[A-Za-z0-9]+/g, keep: 3 }, // Stripe client secrets
  { re: /\bgh[pousr]_[A-Za-z0-9]{30,}/g, keep: 4 }, // GitHub tokens
  { re: /\bgithub_pat_[A-Za-z0-9_]{20,}/g, keep: 11 },
  { re: /\bxox[abposr]-[A-Za-z0-9-]{10,}/g, keep: 5 }, // Slack tokens
  { re: /\bxapp-[A-Za-z0-9-]{10,}/g, keep: 5 },
  { re: /https:\/\/hooks\.slack\.com\/(?:services|workflows|triggers)\/[A-Za-z0-9/_-]+/g, keep: 24 }, // Slack incoming webhooks
  { re: /\bshp(?:at|ss|ca|pa)_[a-fA-F0-9]{16,}/g, keep: 6 }, // Shopify access tokens and shared secrets
  { re: /\bAKIA[0-9A-Z]{16}\b/g, keep: 4 }, // AWS access key id
  { re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, keep: 3 }, // JWT
  { re: /\b(Bearer|Basic) [A-Za-z0-9._~+/=-]{8,}/g, keep: 0 },
];

const EMAIL = /[\p{L}\p{N}._%+-]+@((?:[\p{L}\p{N}-]+\.)+[\p{L}]{2,})/gu;
const CARD = /(?<![\d-])\d(?:[ -]?\d){12,18}(?![\d-])/g;

export function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits.charCodeAt(digits.length - 1 - i) - 48;
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Masks one string value; returns it unchanged when nothing sensitive is found. */
export function maskString(value: string, key: string | number | null, counts: MaskCounts): string {
  if (typeof key === "string" && SECRET_KEY.test(key) && value !== "") {
    counts.tokens++;
    return "[redacted]";
  }
  let out = value;
  for (const { re, keep } of TOKEN_PATTERNS) {
    out = out.replace(re, (m, scheme?: string) => {
      counts.tokens++;
      if (typeof scheme === "string" && (scheme === "Bearer" || scheme === "Basic")) return `${scheme} [redacted]`;
      return `${m.slice(0, keep)}…[redacted]`;
    });
  }
  out = out.replace(EMAIL, (_m, domain: string) => {
    counts.emails++;
    return `***@${domain}`;
  });
  out = out.replace(CARD, (m) => {
    const digits = m.replace(/\D/g, "");
    if (!luhn(digits)) return m;
    counts.cards++;
    let seen = 0;
    const total = digits.length;
    return m.replace(/\d/g, (d) => (++seen > total - 4 ? d : "*"));
  });
  return out;
}

/**
 * Returns a masked copy of the tree. A card-like number stored as a JSON number
 * becomes a string, since "****4242" cannot be a number.
 */
export function maskTree(root: Node): { root: Node; counts: MaskCounts } {
  const counts: MaskCounts = { tokens: 0, emails: 0, cards: 0 };
  const visit = (node: Node, key: string | number | null): Node => {
    switch (node.t) {
      case "object": {
        let changed = false;
        const values = node.values.map((v, i) => {
          const nv = visit(v, node.keys[i]);
          if (nv !== v) changed = true;
          return nv;
        });
        return changed ? { ...node, values } : node;
      }
      case "array": {
        let changed = false;
        const items = node.items.map((v) => {
          const nv = visit(v, key);
          if (nv !== v) changed = true;
          return nv;
        });
        return changed ? { ...node, items } : node;
      }
      case "string": {
        const masked = maskString(node.value, key, counts);
        return masked === node.value ? node : { t: "string", value: masked, raw: JSON.stringify(masked), at: node.at };
      }
      case "number": {
        if (/^\d{13,19}$/.test(node.raw) && luhn(node.raw)) {
          counts.cards++;
          const masked = "*".repeat(node.raw.length - 4) + node.raw.slice(-4);
          return { t: "string", value: masked, raw: JSON.stringify(masked), at: node.at };
        }
        return node;
      }
      default:
        return node;
    }
  };
  // Recursive like the parser: nesting deep enough to overflow is caught as a RangeError by the worker.
  return { root: visit(root, null), counts };
}

export function describeCounts(c: MaskCounts): string {
  const parts: string[] = [];
  if (c.tokens) parts.push(`${c.tokens} token${c.tokens === 1 ? "" : "s"} or secret${c.tokens === 1 ? "" : "s"}`);
  if (c.emails) parts.push(`${c.emails} email${c.emails === 1 ? "" : "s"}`);
  if (c.cards) parts.push(`${c.cards} card-like number${c.cards === 1 ? "" : "s"}`);
  return parts.length ? parts.join(", ") : "nothing sensitive found";
}
