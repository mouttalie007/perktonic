import type { Outcome } from "./types";

// Practical syntax check: one @, a local part without spaces, and a domain of
// letter/digit labels (Unicode allowed) ending in a top-level label of 2+ letters.
const LOCAL = /^[\p{L}\p{N}!#$%&'*+/=?^_`{|}~-]+(\.[\p{L}\p{N}!#$%&'*+/=?^_`{|}~-]+)*$/u;
const LABEL = /^[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?$/u;

/** Trims, removes "mailto:" and <…>, lower-cases, and checks the syntax. No mailbox is contacted. */
export function standardizeEmail(raw: string): Outcome {
  const trimmed = raw.trim();
  if (trimmed === "") return { kind: "empty" };
  let v = trimmed.replace(/^mailto:/i, "");
  const angle = /<([^<>]+)>\s*$/.exec(v);
  if (angle) v = angle[1];
  v = v.trim().toLowerCase();
  const at = v.lastIndexOf("@");
  if (at <= 0 || v.indexOf("@") !== at) return { kind: "invalid", reason: v.includes("@") ? "more than one @" : "no @ sign" };
  const local = v.slice(0, at);
  const domain = v.slice(at + 1).replace(/\.$/, "");
  if (local.length > 64) return { kind: "invalid", reason: "the part before @ is longer than 64 characters" };
  if (!LOCAL.test(local)) return { kind: "invalid", reason: /\s/.test(local) ? "contains a space" : "the part before @ has characters that are not allowed or misplaced dots" };
  const labels = domain.split(".");
  if (labels.length < 2) return { kind: "invalid", reason: "the domain has no ending such as .com" };
  if (!labels.every((l) => LABEL.test(l))) return { kind: "invalid", reason: /\s/.test(domain) ? "contains a space" : "the domain is not valid" };
  if (!/^\p{L}{2,}$/u.test(labels[labels.length - 1])) return { kind: "invalid", reason: "the domain has no valid ending such as .com" };
  const value = `${local}@${domain}`;
  return value === raw ? { kind: "unchanged", value } : { kind: "changed", value };
}
