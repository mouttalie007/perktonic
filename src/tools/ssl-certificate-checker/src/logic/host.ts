import { MAX_INPUT_LENGTH, PORTS } from "./types";

export type HostCheck = { ok: true; host: string; port: number } | { ok: false; error: string };

const PRIVATE_V4 = /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|22[4-9]\.|2[3-5]\d\.)/;

/**
 * Accepts "example.com", "example.com:8443" or a URL. The port must be one of
 * 443, 465, 993, 995 or 8443. Private addresses are refused here for a clearer
 * message; the kit's tlsInspect enforces the real address policy.
 */
export function normalizeHost(raw: string, portField?: number | null): HostCheck {
  let v = raw.trim();
  if (v === "") return { ok: false, error: "Enter a domain name, for example example.com." };
  if (v.length > MAX_INPUT_LENGTH) return { ok: false, error: `The input is ${v.length} characters long; the limit is ${MAX_INPUT_LENGTH}.` };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = `https://${v}`;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return { ok: false, error: "That does not look like a valid domain name." };
  }
  if (u.username || u.password) return { ok: false, error: "Remove the user name and password; only the host name is needed." };
  const host = u.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  const typedPort = u.port ? Number(u.port) : null;
  const port = portField ?? typedPort ?? (u.protocol === "https:" ? 443 : 443);
  if (!(PORTS as readonly number[]).includes(port)) return { ok: false, error: `Port ${port} cannot be checked. Allowed ports: ${PORTS.join(", ")}.` };
  const isV4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  const isV6 = host.includes(":");
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.home\.arpa)$/.test(host) || (isV4 && PRIVATE_V4.test(host)) || (isV6 && /^(::1?|f[cd]|fe[89ab])/i.test(host))) {
    return { ok: false, error: "That address is on a private or local network, so the checker cannot reach it." };
  }
  if (!isV4 && !isV6 && !host.includes(".")) return { ok: false, error: "Enter a full domain name, such as example.com." };
  return { ok: true, host, port };
}
