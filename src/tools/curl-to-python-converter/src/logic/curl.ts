import { ConvertError, emptyRequest, header, tooLarge, type JsonValue, type Part, type Request } from "./model";
import { ShellError, splitShell } from "./shell";


type DataPiece = { kind: "data" | "raw" | "binary" | "urlencode" | "json"; value: string };

// Short options that take a value; the rest are boolean flags that can be grouped (-sSL).
const SHORT_WITH_ARG = new Set(["X", "H", "d", "F", "u", "A", "e", "b", "m", "x", "o", "T", "c", "w", "E", "U", "K", "r", "y", "Y", "z", "C"]);
const SHORT_ALIASES: Record<string, string> = {
  X: "request", H: "header", d: "data", F: "form", u: "user", A: "user-agent", e: "referer", b: "cookie", m: "max-time",
  x: "proxy", o: "output", T: "upload-file", c: "cookie-jar", w: "write-out", E: "cert", U: "proxy-user", K: "config",
  r: "range", y: "speed-time", Y: "speed-limit", z: "time-cond", C: "continue-at",
  k: "insecure", L: "location", I: "head", G: "get", s: "silent", S: "show-error", v: "verbose", i: "include",
  f: "fail", O: "remote-name", N: "no-buffer", n: "netrc", g: "globoff", "#": "progress-bar", "0": "http1.0", "4": "ipv4", "6": "ipv6", j: "junk-session-cookies", J: "remote-header-name", q: "disable",
};
const LONG_WITH_ARG = new Set([
  "request", "header", "data", "data-ascii", "data-raw", "data-binary", "data-urlencode", "json", "form", "form-string", "user", "user-agent", "referer", "cookie",
  "max-time", "connect-timeout", "proxy", "output", "upload-file", "cookie-jar", "write-out", "cert", "key", "cacert", "capath", "proxy-user", "config", "url",
  "max-redirs", "oauth2-bearer", "range", "retry", "retry-delay", "retry-max-time", "resolve", "connect-to", "interface", "limit-rate", "speed-time", "speed-limit",
  "time-cond", "continue-at", "aws-sigv4", "unix-socket", "dns-servers", "local-port", "keepalive-time", "expect100-timeout", "happy-eyeballs-timeout-ms", "trace", "trace-ascii", "stderr", "dump-header",
]);

// Flags that only change curl's console output; they have no meaning in code.
const OUTPUT_ONLY = new Set(["silent", "show-error", "verbose", "include", "progress-bar", "no-progress-meter", "no-buffer", "globoff", "trace", "trace-ascii", "stderr", "write-out", "dump-header", "styled-output", "no-styled-output"]);

function splitHeader(raw: string): [string, string] | null {
  const idx = raw.indexOf(":");
  if (idx <= 0) {
    // curl: "X-Remove;" sends an empty header, "X-Remove:" removes it; both are rare.
    const semi = /^([^;]+);$/.exec(raw);
    return semi ? [semi[1].trim(), ""] : null;
  }
  return [raw.slice(0, idx).trim(), raw.slice(idx + 1).trim()];
}

function urlencode(s: string): string {
  return encodeURIComponent(s).replace(/%20/g, "+").replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function decodeForm(s: string): [string, string][] | null {
  if (s === "" || !/^[^=&\s]+=[^&]*(&[^=&\s]+=[^&]*)*$/.test(s)) return null;
  try {
    return s.split("&").map((pair) => {
      const i = pair.indexOf("=");
      const dec = (x: string) => decodeURIComponent(x.replace(/\+/g, " "));
      return [dec(pair.slice(0, i)), dec(pair.slice(i + 1))];
    });
  } catch {
    return null;
  }
}

function parseFormPart(spec: string, asString: boolean): Part {
  const eq = spec.indexOf("=");
  if (eq <= 0) throw new ConvertError(`-F needs name=value, but got “${spec}”.`);
  const name = spec.slice(0, eq);
  let rest = spec.slice(eq + 1);
  if (asString || !(rest.startsWith("@") || rest.startsWith("<"))) return { name, value: rest, file: false };
  const fromFile = rest.startsWith("@");
  rest = rest.slice(1);
  const [path, ...params] = rest.split(";");
  const part: Part = { name, value: path, file: fromFile };
  for (const p of params) {
    const [k, v] = p.split("=");
    if (k === "type") part.contentType = v;
    if (k === "filename") part.filename = v?.replace(/^"|"$/g, "");
  }
  if (!fromFile) part.value = `<contents of ${path}>`;
  return part;
}

/**
 * Turns a curl command into a Request. Every option is either applied,
 * ignored because it only affects curl's terminal output, or listed in
 * `unmapped` with the reason, so nothing disappears silently.
 */
export function parseCurl(input: string): Request {
  const big = tooLarge(input);
  if (big) throw new ConvertError(big);
  let words: string[];
  let shellWarnings: string[];
  try {
    ({ words, warnings: shellWarnings } = splitShell(input.trim()));
  } catch (e) {
    if (e instanceof ShellError) throw new ConvertError(e.message);
    throw e;
  }
  if (words.length === 0) throw new ConvertError("Paste a curl command, for example: curl https://api.example.com/users");
  if (words[0] !== "curl" && !/(^|\/)curl(\.exe)?$/.test(words[0])) throw new ConvertError(`The command starts with “${words[0]}”, not curl. Paste a command that begins with curl.`);
  const req = emptyRequest();
  req.warnings.push(...shellWarnings);
  const data: DataPiece[] = [];
  const parts: Part[] = [];
  const urls: string[] = [];
  let explicitMethod: string | null = null;
  let head = false;
  let get = false;
  let bearer: string | null = null;

  const opts: { name: string; value: string | null; raw: string }[] = [];
  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    if (w === "--") {
      urls.push(...words.slice(i + 1));
      break;
    }
    if (w.startsWith("--") && w.length > 2) {
      const body = w.slice(2);
      const eq = body.indexOf("=");
      const name = eq >= 0 ? body.slice(0, eq) : body;
      const inline = eq >= 0 ? body.slice(eq + 1) : undefined;
      if (LONG_WITH_ARG.has(name)) {
        const value = inline ?? words[++i];
        if (value === undefined) throw new ConvertError(`--${name} needs a value after it.`);
        opts.push({ name, value, raw: `--${name}` });
      } else opts.push({ name, value: null, raw: w });
      continue;
    }
    if (w.startsWith("-") && w.length > 1) {
      for (let j = 1; j < w.length; j++) {
        const ch = w[j];
        const long = SHORT_ALIASES[ch];
        if (!long) {
          req.unmapped.push({ option: `-${ch}`, reason: "unknown curl option; it was skipped" });
          continue;
        }
        if (SHORT_WITH_ARG.has(ch)) {
          const attached = w.slice(j + 1);
          const value = attached !== "" ? attached : words[++i];
          if (value === undefined) throw new ConvertError(`-${ch} needs a value after it.`);
          opts.push({ name: long, value, raw: `-${ch}` });
          break;
        }
        opts.push({ name: long, value: null, raw: `-${ch}` });
      }
      continue;
    }
    urls.push(w);
  }

  for (const { name, value, raw } of opts) {
    const v = value ?? "";
    switch (name) {
      case "request":
        explicitMethod = v.toUpperCase();
        break;
      case "header": {
        if (v.startsWith("@")) {
          req.unmapped.push({ option: `${raw} ${v}`, reason: "headers read from a file cannot be converted; paste them as -H options" });
          break;
        }
        const h = splitHeader(v);
        if (!h) req.unmapped.push({ option: `${raw} '${v}'`, reason: "not a valid header (Name: value)" });
        else req.headers.push(h);
        break;
      }
      case "data":
      case "data-ascii":
        data.push({ kind: "data", value: v });
        break;
      case "data-raw":
        data.push({ kind: "raw", value: v });
        break;
      case "data-binary":
        data.push({ kind: "binary", value: v });
        break;
      case "data-urlencode":
        data.push({ kind: "urlencode", value: v });
        break;
      case "json":
        data.push({ kind: "json", value: v });
        break;
      case "form":
        parts.push(parseFormPart(v, false));
        break;
      case "form-string":
        parts.push(parseFormPart(v, true));
        break;
      case "user": {
        const i = v.indexOf(":");
        req.auth = i < 0 ? { user: v, password: "" } : { user: v.slice(0, i), password: v.slice(i + 1) };
        if (i < 0) req.warnings.push("-u has no password; curl would prompt for one. The code uses an empty password.");
        break;
      }
      case "oauth2-bearer":
        bearer = v;
        break;
      case "user-agent":
        req.headers.push(["User-Agent", v]);
        break;
      case "referer":
        req.headers.push(["Referer", v.replace(/;auto$/, "")]);
        break;
      case "cookie":
        if (v.includes("=")) req.headers.push(["Cookie", v]);
        else req.unmapped.push({ option: `${raw} ${v}`, reason: "reading cookies from a file is not converted; pass them as -b 'name=value'" });
        break;
      case "insecure":
        req.insecure = true;
        break;
      case "location":
        req.followRedirects = true;
        break;
      case "max-redirs":
        req.maxRedirects = Number(v);
        break;
      case "head":
        head = true;
        break;
      case "get":
        get = true;
        break;
      case "compressed":
        req.compressed = true;
        break;
      case "max-time":
        req.timeoutSeconds = Number(v);
        break;
      case "connect-timeout":
        req.connectTimeoutSeconds = Number(v);
        break;
      case "proxy":
        req.proxy = v;
        break;
      case "url":
        urls.push(v);
        break;
      case "digest":
      case "ntlm":
      case "negotiate":
        req.unmapped.push({ option: raw, reason: `${name} authentication is not converted; the code uses basic authentication` });
        break;
      case "basic":
        break;
      case "output":
      case "remote-name":
      case "remote-header-name":
        req.unmapped.push({ option: value ? `${raw} ${v}` : raw, reason: "saving the response to a file: write the response body to a file in your code" });
        break;
      case "fail":
        req.unmapped.push({ option: raw, reason: "curl exits with an error on HTTP 4xx/5xx; check the status code in your code (e.g. response.raise_for_status() in Python)" });
        break;
      default:
        if (OUTPUT_ONLY.has(name)) break;
        req.unmapped.push({ option: value !== null ? `${raw} ${v}` : raw, reason: name.startsWith("http") ? "the HTTP version is chosen by the library" : "no equivalent in the generated code" });
    }
  }

  if (urls.length === 0) throw new ConvertError("No URL found. Add the address, e.g. curl https://api.example.com/items");
  if (urls.length > 1) req.warnings.push(`curl was given ${urls.length} URLs; only the first (${urls[0]}) is converted.`);
  let url = urls[0];
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = `http://${url}`;
  try {
    new URL(url);
  } catch {
    throw new ConvertError(`“${urls[0]}” is not a valid URL.`);
  }
  if (!/^https?:/i.test(url)) req.unmapped.push({ option: url.split(":")[0] + "://", reason: "only HTTP and HTTPS requests are converted" });
  if (bearer !== null && !header(req, "authorization")) req.headers.push(["Authorization", `Bearer ${bearer}`]);
  if (parts.length > 0 && data.length > 0) throw new ConvertError("-F (multipart form) and -d (data) cannot be used in the same curl command.");

  // Build the body the way curl joins several -d options: with &.
  if (data.length > 0) {
    const pieces = data.map((d) => {
      if (d.kind === "urlencode") {
        const eq = d.value.indexOf("=");
        const at = d.value.indexOf("@");
        if (at === 0 || (at > 0 && (eq < 0 || at < eq))) {
          req.unmapped.push({ option: `--data-urlencode ${d.value}`, reason: "reading the value from a file is not converted" });
          return d.value;
        }
        if (eq < 0) return urlencode(d.value);
        if (eq === 0) return urlencode(d.value.slice(1));
        return `${d.value.slice(0, eq)}=${urlencode(d.value.slice(eq + 1))}`;
      }
      if (d.kind === "data" && d.value.startsWith("@")) return { file: d.value.slice(1) };
      if (d.kind === "binary" && d.value.startsWith("@")) return { file: d.value.slice(1) };
      if (d.kind === "json" && d.value.startsWith("@")) return { file: d.value.slice(1) };
      // Plain -d strips line breaks, like curl does when reading data.
      return d.kind === "data" ? d.value.replace(/[\r\n]/g, "") : d.value;
    });
    const isJson = data.some((d) => d.kind === "json");
    if (isJson) {
      if (!header(req, "content-type")) req.headers.push(["Content-Type", "application/json"]);
      if (!header(req, "accept")) req.headers.push(["Accept", "application/json"]);
    }
    const files = pieces.filter((p): p is { file: string } => typeof p !== "string");
    if (files.length > 0) {
      if (pieces.length > 1) req.warnings.push("Data from a file was combined with other -d values; only the file is used in the code.");
      req.body = { kind: "file", path: files[0].file };
    } else {
      const text = (pieces as string[]).join(isJson ? "" : "&");
      if (get) {
        url += (url.includes("?") ? "&" : "?") + text;
      } else {
        const ctype = (header(req, "content-type") ?? "").toLowerCase();
        let parsed: JsonValue | undefined;
        try {
          parsed = JSON.parse(text) as JsonValue;
        } catch {
          parsed = undefined;
        }
        const form = decodeForm(text);
        if (ctype.includes("json") && parsed !== undefined && !/\d{16,}/.test(text)) req.body = { kind: "json", text, value: parsed };
        else if (!ctype && form && data.every((d) => d.kind === "data" || d.kind === "urlencode")) req.body = { kind: "form", fields: form };
        else req.body = { kind: "raw", text };
        if (!ctype) {
          if (parsed !== undefined && typeof parsed === "object" && parsed !== null) {
            req.warnings.push("The data looks like JSON, but no Content-Type header is set, so curl sends it as application/x-www-form-urlencoded. Add -H 'Content-Type: application/json' (or use --json) if the API expects JSON.");
          }
          // Form bodies get this header from each library's form encoder; raw text needs it spelled out to match curl.
          if (req.body.kind !== "form") req.headers.push(["Content-Type", "application/x-www-form-urlencoded"]);
        }
      }
    }
  }
  if (parts.length > 0) req.body = { kind: "multipart", parts };

  req.url = url;
  req.method = explicitMethod ?? (head ? "HEAD" : req.body ? "POST" : "GET");
  if (explicitMethod === "GET" && req.body) req.warnings.push("-X GET with a body: most servers ignore a GET body. The code sends it anyway, like curl.");
  if (req.insecure) req.warnings.push("-k turns off TLS certificate checks, so anyone between you and the server can read or change the traffic. Use it only for local testing; the generated code does the same.");
  return req;
}
