import type { Note } from "./performance";
import type { SecurityCheck } from "./security";

export type ServerKind = "nginx" | "apache" | "caddy";

export interface SnippetInput {
  checks: SecurityCheck[];
  notes: Note[];
}

interface Change {
  header: string;
  value: string;
  comment: string;
}

function changes(input: SnippetInput): Change[] {
  const out: Change[] = [];
  for (const c of input.checks) {
    if (!c.fix) continue;
    const value = c.id === "csp" ? "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'" : c.fix;
    const comment =
      c.id === "csp"
        ? "Starter policy: test it as Content-Security-Policy-Report-Only first, then add the domains your pages really load from."
        : c.id === "hsts"
          ? "Only send over HTTPS. Add '; preload' after checking every subdomain supports HTTPS."
          : `${c.header} (${c.status === "fail" ? "missing" : "weak"})`;
    out.push({ header: c.header, value, comment });
  }
  return out;
}

const esc = (v: string) => v.replace(/"/g, '\\"');

/**
 * Copy-ready configuration that adds the missing or weak headers, plus
 * compression and version hiding when the analysis asked for them.
 */
export function buildSnippet(kind: ServerKind, input: SnippetInput): string {
  const list = changes(input);
  const needsCompression = input.notes.some((n) => n.topic === "compression" && n.level === "fail");
  const leaksVersion = input.notes.some((n) => n.topic === "disclosure" && /version|stack/.test(n.message));
  if (list.length === 0 && !needsCompression && !leaksVersion) {
    return "# Nothing to change: all graded headers pass.\n";
  }
  const lines: string[] = [];
  if (kind === "nginx") {
    lines.push("# Inside the server { } block (or http { } for all sites). 'always' also adds headers to error pages.");
    for (const c of list) lines.push(`# ${c.comment}`, `add_header ${c.header} "${esc(c.value)}" always;`);
    if (needsCompression) lines.push("", "gzip on;", "gzip_vary on;", "gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;", "# For Brotli, install ngx_brotli and add: brotli on; brotli_types <same list>;");
    if (leaksVersion) lines.push("", "server_tokens off;", "# Also remove X-Powered-By in the application (e.g. expose_php = Off in php.ini).");
  } else if (kind === "apache") {
    lines.push("# In the VirtualHost or .htaccess. Requires mod_headers (a2enmod headers).");
    for (const c of list) lines.push(`# ${c.comment}`, `Header always set ${c.header} "${esc(c.value)}"`);
    if (needsCompression) lines.push("", "# Requires mod_deflate (or mod_brotli on Apache 2.4.26+)", "AddOutputFilterByType DEFLATE text/html text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml");
    if (leaksVersion) lines.push("", "# In the main server config (not .htaccess):", "ServerTokens Prod", "ServerSignature Off", "Header always unset X-Powered-By");
  } else {
    lines.push("# In the site block of your Caddyfile.");
    if (needsCompression) lines.push("encode zstd gzip");
    if (list.length > 0 || leaksVersion) {
      lines.push("header {");
      for (const c of list) lines.push(`\t# ${c.comment}`, `\t${c.header} "${esc(c.value)}"`);
      if (leaksVersion) lines.push("\t-Server", "\t-X-Powered-By");
      lines.push("}");
    }
  }
  return lines.join("\n") + "\n";
}
