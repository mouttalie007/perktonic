export type CheckStatus = "pass" | "partial" | "fail";

export interface SecurityCheck {
  id: "hsts" | "csp" | "xfo" | "xcto" | "referrer" | "permissions";
  header: string;
  status: CheckStatus;
  points: number;
  max: number;
  value: string | null;
  notes: string[];
  /** Recommended value when the header is missing or weak; null when it is fine. */
  fix: string | null;
}

export type Headers = Record<string, string[]>;

/** The rubric shown on the page. Keep in sync with the scoring below (a test checks the totals). */
export const RUBRIC: { header: string; max: number; rules: string[] }[] = [
  { header: "Strict-Transport-Security", max: 25, rules: ["max-age ≥ 1 year: 20 points; ≥ 6 months: 15; shorter: 5; max-age=0: 0", "includeSubDomains: +5", "Not counted when the page is served over plain HTTP (0 points, serve HTTPS first)", "preload is reported, not scored"] },
  { header: "Content-Security-Policy", max: 25, rules: ["Present: 25 points, minus deductions (minimum 5)", "'unsafe-inline' scripts without a nonce, hash or 'strict-dynamic': −10", "'unsafe-eval': −5", "Wildcard or scheme-only script sources (*, https:, http:, data:): −5", "No object-src 'none' (or default-src 'none'): −3", "Report-Only header only: 5 points"] },
  { header: "X-Frame-Options", max: 15, rules: ["DENY or SAMEORIGIN, or CSP frame-ancestors: 15 points", "ALLOW-FROM (ignored by modern browsers): 5", "Missing or invalid: 0"] },
  { header: "X-Content-Type-Options", max: 15, rules: ["nosniff: 15 points, anything else: 0"] },
  { header: "Referrer-Policy", max: 10, rules: ["no-referrer, same-origin, strict-origin or strict-origin-when-cross-origin: 10 points", "origin or origin-when-cross-origin: 5", "no-referrer-when-downgrade or unsafe-url: 2", "With several values, the last valid one counts (as in browsers)"] },
  { header: "Permissions-Policy", max: 10, rules: ["Present with at least one directive: 10 points", "Only the old Feature-Policy, or an empty value: 5"] },
];

export const GRADES: { min: number; grade: string }[] = [
  { min: 95, grade: "A+" },
  { min: 85, grade: "A" },
  { min: 70, grade: "B" },
  { min: 55, grade: "C" },
  { min: 40, grade: "D" },
  { min: 0, grade: "F" },
];

export function gradeFor(score: number): string {
  return GRADES.find((g) => score >= g.min)?.grade ?? "F";
}

/** Several headers with the same name are combined with ", ", as HTTP allows for list headers. */
function joined(h: Headers, name: string): string | null {
  const v = h[name];
  return v && v.length > 0 ? v.join(", ") : null;
}

export const RECOMMENDED = {
  hsts: "max-age=31536000; includeSubDomains",
  csp: "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
  xfo: "SAMEORIGIN",
  xcto: "nosniff",
  referrer: "strict-origin-when-cross-origin",
  permissions: "camera=(), microphone=(), geolocation=(), payment=()",
};

export function checkHsts(h: Headers, https: boolean): SecurityCheck {
  const value = joined(h, "strict-transport-security");
  const base: SecurityCheck = { id: "hsts", header: "Strict-Transport-Security", status: "fail", points: 0, max: 25, value, notes: [], fix: RECOMMENDED.hsts };
  if (!https) {
    base.notes.push("The page is served over plain HTTP. Browsers ignore HSTS on HTTP responses; redirect to HTTPS and send the header there.");
    return base;
  }
  if (!value) {
    base.notes.push("Missing. Without HSTS, the first visit can be downgraded to HTTP by an attacker on the network.");
    return base;
  }
  const first = (h["strict-transport-security"] ?? [])[0] ?? value;
  const age = /max-age\s*=\s*"?(\d+)"?/i.exec(first);
  const subs = /includesubdomains/i.test(first);
  const preload = /\bpreload\b/i.test(first);
  if (!age) {
    base.notes.push("max-age is missing, so browsers ignore the header.");
    return base;
  }
  const seconds = Number(age[1]);
  let points = seconds >= 31_536_000 ? 20 : seconds >= 15_768_000 ? 15 : seconds > 0 ? 5 : 0;
  if (seconds === 0) base.notes.push("max-age=0 tells browsers to forget HSTS for this site.");
  else if (seconds < 31_536_000) base.notes.push(`max-age is ${Math.round(seconds / 86400)} days; one year (31536000) is the common recommendation.`);
  if (subs && seconds > 0) points += 5;
  else if (seconds > 0) base.notes.push("includeSubDomains is missing, so subdomains are not protected.");
  if (preload) {
    const eligible = seconds >= 31_536_000 && subs;
    base.notes.push(eligible ? "preload is set and the header meets the preload list requirements (max-age ≥ 1 year, includeSubDomains)." : "preload is set, but the preload list also needs max-age ≥ 31536000 and includeSubDomains.");
  }
  if ((h["strict-transport-security"] ?? []).length > 1) base.notes.push("The header is sent more than once; browsers use only the first one.");
  base.points = points;
  base.status = points === 25 ? "pass" : points > 0 ? "partial" : "fail";
  base.fix = points === 25 ? null : RECOMMENDED.hsts;
  return base;
}

export function parseCsp(policy: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const part of policy.split(";")) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const name = tokens[0].toLowerCase();
    if (!out.has(name)) out.set(name, tokens.slice(1));
  }
  return out;
}

export function checkCsp(h: Headers): SecurityCheck {
  const value = joined(h, "content-security-policy");
  const reportOnly = joined(h, "content-security-policy-report-only");
  const base: SecurityCheck = { id: "csp", header: "Content-Security-Policy", status: "fail", points: 0, max: 25, value: value ?? reportOnly, notes: [], fix: RECOMMENDED.csp };
  if (!value) {
    if (reportOnly) {
      base.points = 5;
      base.status = "partial";
      base.notes.push("Only Content-Security-Policy-Report-Only is sent: violations are reported but nothing is blocked. Switch to Content-Security-Policy once the reports are clean.");
    } else {
      base.notes.push("Missing. A CSP limits where scripts can load from and is the main defence against cross-site scripting.");
    }
    return base;
  }
  // With several CSP headers every policy applies; the first one is analysed, which is the usual case.
  const policy = parseCsp((h["content-security-policy"] ?? [value])[0]);
  const scripts = policy.get("script-src") ?? policy.get("default-src") ?? null;
  let points = 25;
  if (!scripts) {
    points -= 10;
    base.notes.push("No script-src or default-src, so scripts are not restricted at all.");
  } else {
    const lower = scripts.map((s) => s.toLowerCase());
    const hasNonceOrHash = lower.some((s) => /^'(nonce-|sha256-|sha384-|sha512-)/.test(s) || s === "'strict-dynamic'");
    if (lower.includes("'unsafe-inline'") && !hasNonceOrHash) {
      points -= 10;
      base.notes.push("'unsafe-inline' allows inline scripts, which removes most of the XSS protection. Use nonces or hashes instead.");
    } else if (lower.includes("'unsafe-inline'")) {
      base.notes.push("'unsafe-inline' is present but ignored by modern browsers because a nonce, hash or 'strict-dynamic' is also set.");
    }
    if (lower.includes("'unsafe-eval'")) {
      points -= 5;
      base.notes.push("'unsafe-eval' allows eval() and new Function().");
    }
    if (lower.some((s) => s === "*" || s === "https:" || s === "http:" || s === "data:")) {
      points -= 5;
      base.notes.push("A wildcard or scheme-only source (*, https:, http:, data:) lets scripts load from almost anywhere.");
    }
  }
  const objectSrc = policy.get("object-src");
  const defaultSrc = policy.get("default-src");
  if (!(objectSrc?.includes("'none'") || (!objectSrc && defaultSrc?.includes("'none'")))) {
    points -= 3;
    base.notes.push("Add object-src 'none' to block plugins such as <object> and <embed>.");
  }
  if (!policy.has("frame-ancestors")) base.notes.push("No frame-ancestors directive; X-Frame-Options has to protect against clickjacking instead.");
  base.points = Math.max(5, points);
  base.status = base.points === 25 ? "pass" : "partial";
  base.fix = base.points === 25 ? null : "Remove the weak sources listed above, e.g. start from: " + RECOMMENDED.csp;
  return base;
}

export function checkXfo(h: Headers): SecurityCheck {
  const value = joined(h, "x-frame-options");
  const csp = (h["content-security-policy"] ?? [])[0];
  const viaCsp = csp ? parseCsp(csp).has("frame-ancestors") : false;
  const base: SecurityCheck = { id: "xfo", header: "X-Frame-Options", status: "fail", points: 0, max: 15, value, notes: [], fix: RECOMMENDED.xfo };
  const v = value?.split(",")[0].trim().toUpperCase() ?? "";
  if (v === "DENY" || v === "SAMEORIGIN" || viaCsp) {
    base.points = 15;
    base.status = "pass";
    base.fix = null;
    if (!value) base.notes.push("Not sent, but CSP frame-ancestors gives the same protection in modern browsers.");
    return base;
  }
  if (v.startsWith("ALLOW-FROM")) {
    base.points = 5;
    base.status = "partial";
    base.notes.push("ALLOW-FROM is ignored by current browsers. Use CSP frame-ancestors to allow specific sites.");
    return base;
  }
  base.notes.push(value ? `“${value}” is not a valid value; use DENY or SAMEORIGIN.` : "Missing. Other sites can embed this page in a frame (clickjacking).");
  return base;
}

export function checkXcto(h: Headers): SecurityCheck {
  const value = joined(h, "x-content-type-options");
  const ok = value?.split(",")[0].trim().toLowerCase() === "nosniff";
  return {
    id: "xcto",
    header: "X-Content-Type-Options",
    status: ok ? "pass" : "fail",
    points: ok ? 15 : 0,
    max: 15,
    value,
    notes: ok ? [] : [value ? `“${value}” is not valid; the only value is nosniff.` : "Missing. Browsers may guess (“sniff”) the type of a file and run it as script."],
    fix: ok ? null : RECOMMENDED.xcto,
  };
}

const REFERRER_POINTS: Record<string, number> = {
  "no-referrer": 10,
  "same-origin": 10,
  "strict-origin": 10,
  "strict-origin-when-cross-origin": 10,
  origin: 5,
  "origin-when-cross-origin": 5,
  "no-referrer-when-downgrade": 2,
  "unsafe-url": 2,
};

export function checkReferrer(h: Headers): SecurityCheck {
  const value = joined(h, "referrer-policy");
  const base: SecurityCheck = { id: "referrer", header: "Referrer-Policy", status: "fail", points: 0, max: 10, value, notes: [], fix: RECOMMENDED.referrer };
  if (!value) {
    base.notes.push("Missing. Modern browsers default to strict-origin-when-cross-origin, but older ones send the full URL to other sites.");
    return base;
  }
  const tokens = value.split(",").map((t) => t.trim().toLowerCase());
  const valid = tokens.filter((t) => t in REFERRER_POINTS);
  if (valid.length === 0) {
    base.notes.push(`“${value}” contains no valid policy.`);
    return base;
  }
  const effective = valid[valid.length - 1];
  if (tokens.length > 1) base.notes.push(`Several values: browsers use the last one they understand, “${effective}”.`);
  base.points = REFERRER_POINTS[effective];
  base.status = base.points === 10 ? "pass" : "partial";
  if (base.points < 10) base.notes.push(`“${effective}” can leak full URLs (paths and query strings) to other sites.`);
  base.fix = base.points === 10 ? null : RECOMMENDED.referrer;
  return base;
}

export function checkPermissions(h: Headers): SecurityCheck {
  const value = joined(h, "permissions-policy");
  const legacy = joined(h, "feature-policy");
  const base: SecurityCheck = { id: "permissions", header: "Permissions-Policy", status: "fail", points: 0, max: 10, value: value ?? legacy, notes: [], fix: RECOMMENDED.permissions };
  if (value && /[a-z-]+\s*=/.test(value)) {
    base.points = 10;
    base.status = "pass";
    base.fix = null;
    return base;
  }
  if (value || legacy) {
    base.points = 5;
    base.status = "partial";
    base.notes.push(value ? "The header has no directives in the form feature=(…)." : "Only the old Feature-Policy header is sent; browsers now read Permissions-Policy.");
    return base;
  }
  base.notes.push("Missing. Turn off browser features the site does not use (camera, microphone, geolocation…).");
  return base;
}

export interface SecurityReport {
  checks: SecurityCheck[];
  score: number;
  grade: string;
}

export function gradeSecurity(h: Headers, finalUrl: string): SecurityReport {
  const https = finalUrl.startsWith("https:");
  const checks = [checkHsts(h, https), checkCsp(h), checkXfo(h), checkXcto(h), checkReferrer(h), checkPermissions(h)];
  const score = checks.reduce((s, c) => s + c.points, 0);
  return { checks, score, grade: gradeFor(score) };
}
