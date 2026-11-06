import { ConvertError, emptyRequest, header, type JsonValue, type Request } from "./model";
import { shellQuote } from "./shell";

/** Values the snippet readers understand. "name" is an identifier we could not resolve. */
type Val = JsonValue | { $call: string; args: Val[]; kwargs: Record<string, Val> } | { $name: string } | { $tuple: Val[] };

class Reader {
  i = 0;
  constructor(
    private readonly src: string,
    private readonly lang: "python" | "js",
  ) {}

  ws() {
    for (;;) {
      while (this.i < this.src.length && /\s/.test(this.src[this.i])) this.i++;
      const rest = this.src.slice(this.i, this.i + 2);
      if (this.lang === "python" && this.src[this.i] === "#") this.skipLine();
      else if (this.lang === "js" && rest === "//") this.skipLine();
      else if (this.lang === "js" && rest === "/*") {
        const end = this.src.indexOf("*/", this.i + 2);
        this.i = end < 0 ? this.src.length : end + 2;
      } else return;
    }
  }

  skipLine() {
    const nl = this.src.indexOf("\n", this.i);
    this.i = nl < 0 ? this.src.length : nl + 1;
  }

  peek(s: string): boolean {
    this.ws();
    return this.src.startsWith(s, this.i);
  }

  eat(s: string): boolean {
    if (this.peek(s)) {
      this.i += s.length;
      return true;
    }
    return false;
  }

  expect(s: string) {
    if (!this.eat(s)) throw new ConvertError(`Expected “${s}” near “${this.src.slice(this.i, this.i + 20).trim()}”.`);
  }

  ident(): string | null {
    this.ws();
    const m = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/.exec(this.src.slice(this.i));
    if (!m) return null;
    this.i += m[0].length;
    return m[0];
  }

  string(): string | null {
    this.ws();
    const prefix = this.lang === "python" ? /^([rRbBuU]{0,2})(['"]{3}|['"])/.exec(this.src.slice(this.i)) : /^(['"`])/.exec(this.src.slice(this.i));
    if (!prefix) return null;
    const flags = this.lang === "python" ? prefix[1].toLowerCase() : "";
    const quote = this.lang === "python" ? prefix[2] : prefix[1];
    if (/f/.test(flags)) throw new ConvertError("f-strings are not supported; replace them with plain strings.");
    this.i += prefix[0].length;
    let out = "";
    for (;;) {
      if (this.i >= this.src.length) throw new ConvertError("A string is not closed.");
      if (this.src.startsWith(quote, this.i)) {
        this.i += quote.length;
        break;
      }
      const ch = this.src[this.i];
      if (quote === "`" && ch === "$" && this.src[this.i + 1] === "{") throw new ConvertError("Template literals with ${…} are not supported; use the final value.");
      if (ch === "\\" && !flags.includes("r")) {
        const e = this.src[this.i + 1];
        const map: Record<string, string> = { n: "\n", t: "\t", r: "\r", "\\": "\\", "'": "'", "\"": "\"", "`": "`", "0": "\0", b: "\b", f: "\f", v: "\v" };
        if (e === "u") {
          out += String.fromCharCode(parseInt(this.src.slice(this.i + 2, this.i + 6), 16));
          this.i += 6;
        } else if (e === "x") {
          out += String.fromCharCode(parseInt(this.src.slice(this.i + 2, this.i + 4), 16));
          this.i += 4;
        } else if (e === "\n") this.i += 2;
        else {
          out += map[e] ?? "\\" + e;
          this.i += 2;
        }
        continue;
      }
      out += ch;
      this.i++;
    }
    // Adjacent string literals concatenate in Python ("a" "b"); + concatenation is handled by the caller.
    const next = this.lang === "python" ? this.string() : null;
    return next === null ? out : out + next;
  }

  value(): Val {
    this.ws();
    const s = this.string();
    if (s !== null) {
      let acc = s;
      while (this.peek("+")) {
        const save = this.i;
        this.i++;
        const more = this.string();
        if (more === null) {
          this.i = save;
          break;
        }
        acc += more;
      }
      return acc;
    }
    const num = /^-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/.exec(this.src.slice(this.i));
    if (num) {
      this.i += num[0].length;
      return Number(num[0]);
    }
    if (this.eat("{")) {
      // Values stay unevaluated so calls such as JSON.stringify(…) inside options survive until used.
      const obj: Record<string, Val> = {};
      while (!this.eat("}")) {
        let key = this.string();
        if (key === null && this.lang === "js") key = this.ident();
        if (key === null) throw new ConvertError(`Could not read a key near “${this.src.slice(this.i, this.i + 20).trim()}”.`);
        this.expect(":");
        obj[key] = this.value();
        if (!this.eat(",")) {
          this.expect("}");
          break;
        }
      }
      return obj as Val;
    }
    if (this.eat("[")) {
      const arr: Val[] = [];
      while (!this.eat("]")) {
        arr.push(this.value());
        if (!this.eat(",")) {
          this.expect("]");
          break;
        }
      }
      return arr as JsonValue;
    }
    if (this.lang === "python" && this.eat("(")) {
      const items: Val[] = [];
      while (!this.eat(")")) {
        items.push(this.value());
        if (!this.eat(",")) {
          this.expect(")");
          break;
        }
      }
      return { $tuple: items };
    }
    const id = this.ident();
    if (id === null) throw new ConvertError(`Could not read the value near “${this.src.slice(this.i, this.i + 20).trim()}”.`);
    const consts: Record<string, JsonValue> = this.lang === "python" ? { True: true, False: false, None: null } : { true: true, false: false, null: null, undefined: null };
    if (id in consts) return consts[id];
    const isNew = this.lang === "js" && id === "new";
    const name = isNew ? this.ident() ?? "" : id;
    if (this.eat("(")) {
      const args: Val[] = [];
      const kwargs: Record<string, Val> = {};
      while (!this.eat(")")) {
        const save = this.i;
        const kw = this.lang === "python" ? this.ident() : null;
        if (kw && this.peek("=") && !this.peek("==")) {
          this.i++;
          kwargs[kw] = this.value();
        } else {
          this.i = save;
          args.push(this.value());
        }
        if (!this.eat(",")) {
          this.expect(")");
          break;
        }
      }
      return { $call: name, args, kwargs };
    }
    return { $name: name };
  }

  plain(v: Val, what: string): JsonValue {
    if (v !== null && typeof v === "object" && !Array.isArray(v) && ("$call" in v || "$name" in v || "$tuple" in v)) {
      if ("$tuple" in v) return (v as { $tuple: Val[] }).$tuple.map((x) => this.plain(x, what));
      throw new ConvertError(`${what} uses ${"$call" in v ? `${(v as { $call: string }).$call}(…)` : (v as { $name: string }).$name}, which this converter cannot evaluate. Replace it with its value.`);
    }
    if (Array.isArray(v)) return v.map((x) => this.plain(x as Val, what));
    if (v !== null && typeof v === "object") {
      const out: Record<string, JsonValue> = {};
      for (const [k, x] of Object.entries(v as Record<string, Val>)) out[k] = this.plain(x, `the value of “${k}”`);
      return out;
    }
    return v as JsonValue;
  }

  done(): boolean {
    this.ws();
    return this.i >= this.src.length;
  }
}

/** Reads `name = value` assignments and the first call to a function whose name matches `callRe`. */
function scan(src: string, lang: "python" | "js", callRe: RegExp): { vars: Map<string, Val>; call: { $call: string; args: Val[]; kwargs: Record<string, Val> } } {
  const vars = new Map<string, Val>();
  const r = new Reader(src, lang);
  while (!r.done()) {
    r.eat("await");
    if (lang === "js") {
      if (!r.eat("const") && !r.eat("let")) r.eat("var");
    }
    const start = r.i;
    const name = r.ident();
    if (name === null) {
      throw new ConvertError(`Could not read the code near “${src.slice(r.i, r.i + 30).trim()}”. Only simple assignments and one request call are supported.`);
    }
    if (name === "import" || name === "from" || name === "export") {
      r.skipLine();
      continue;
    }
    if (r.eat("=") && !r.peek("=")) {
      r.eat("await");
      const v = r.value();
      if (typeof v === "object" && v !== null && "$call" in v && callRe.test((v as { $call: string }).$call)) return { vars, call: v as { $call: string; args: Val[]; kwargs: Record<string, Val> } };
      vars.set(name, v);
    } else {
      r.i = start;
      const v = r.value();
      if (typeof v === "object" && v !== null && "$call" in v && callRe.test((v as { $call: string }).$call)) return { vars, call: v as { $call: string; args: Val[]; kwargs: Record<string, Val> } };
      if (typeof v === "object" && v !== null && "$call" in v && /^(print|console\.log)$/.test((v as { $call: string }).$call)) {
        // print(response.text) and similar lines after the request are fine to skip.
      }
    }
    r.eat(";");
  }
  throw new ConvertError(lang === "python" ? "No requests.get/post/… call was found." : "No fetch(…) call was found.");
}

function resolve(v: Val, vars: Map<string, Val>, depth = 0): Val {
  if (depth > 20) throw new ConvertError("A variable refers to itself.");
  if (v !== null && typeof v === "object" && !Array.isArray(v) && "$name" in v) {
    const found = vars.get((v as { $name: string }).$name);
    if (found === undefined) throw new ConvertError(`The variable ${(v as { $name: string }).$name} is not defined in the snippet. Paste its definition too.`);
    return resolve(found, vars, depth + 1);
  }
  return v;
}

function asString(v: Val, what: string): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  throw new ConvertError(`${what} must be a plain string here.`);
}

function asObject(v: Val, what: string): Record<string, Val> {
  if (v && typeof v === "object" && !Array.isArray(v) && !("$call" in v) && !("$name" in v) && !("$tuple" in v)) return v as Record<string, Val>;
  throw new ConvertError(`${what} must be a dictionary/object literal.`);
}

function pairsOf(v: Val, what: string): [string, string][] {
  if (Array.isArray(v)) {
    return v.map((p) => {
      const pair = (p && typeof p === "object" && "$tuple" in (p as object) ? (p as { $tuple: Val[] }).$tuple : p) as Val[];
      if (!Array.isArray(pair) || pair.length !== 2) throw new ConvertError(`${what} must be pairs of [name, value].`);
      return [asString(pair[0], what), asString(pair[1], what)];
    });
  }
  return Object.entries(asObject(v, what)).map(([k, x]) => [k, typeof x === "string" ? x : JSON.stringify(new Reader("", "js").plain(x, `${what} “${k}”`))]);
}

const PY_METHODS = /^(requests|session|s|client|http)\.(get|post|put|patch|delete|head|options|request)$/;

/** Python requests snippet → Request. Supports the common keyword arguments; anything else is listed as unmapped. */
export function fromPython(src: string): Request {
  const { vars, call } = scan(src, "python", PY_METHODS);
  const req = emptyRequest();
  req.followRedirects = true;
  const method = call.$call.split(".").pop()!;
  const args = [...call.args];
  req.method = method === "request" ? asString(resolve(args.shift() ?? "", vars), "The method").toUpperCase() : method.toUpperCase();
  req.url = asString(resolve(call.kwargs.url ?? args[0] ?? "", vars), "The URL");
  if (!req.url) throw new ConvertError("The request has no URL.");
  for (const [key, raw] of Object.entries(call.kwargs)) {
    if (key === "url" || key === "method") continue;
    const v = resolve(raw, vars);
    switch (key) {
      case "headers":
        req.headers.push(...pairsOf(v, "headers"));
        break;
      case "params": {
        const u = new URL(req.url);
        for (const [k, x] of pairsOf(v, "params")) u.searchParams.append(k, x);
        req.url = u.toString();
        break;
      }
      case "json":
        req.body = { kind: "json", text: JSON.stringify(new Reader("", "python").plain(v, "json")), value: new Reader("", "python").plain(v, "json") };
        if (!header(req, "content-type")) req.headers.push(["Content-Type", "application/json"]);
        break;
      case "data":
        if (typeof v === "string") req.body = { kind: "raw", text: v };
        else if (v && typeof v === "object" && "$call" in v && /(^|\.)dumps$/.test((v as { $call: string }).$call)) {
          const inner = resolve((v as { args: Val[] }).args[0], vars);
          const value = new Reader("", "python").plain(inner, "json.dumps");
          req.body = { kind: "json", text: JSON.stringify(value), value };
        } else req.body = { kind: "form", fields: pairsOf(v, "data") };
        break;
      case "auth": {
        const t = v && typeof v === "object" && "$tuple" in (v as object) ? (v as { $tuple: Val[] }).$tuple : Array.isArray(v) ? (v as Val[]) : null;
        if (t && t.length === 2) req.auth = { user: asString(resolve(t[0], vars), "auth"), password: asString(resolve(t[1], vars), "auth") };
        else req.unmapped.push({ option: "auth=…", reason: "only auth=(user, password) basic authentication is converted" });
        break;
      }
      case "cookies":
        req.headers.push(["Cookie", pairsOf(v, "cookies").map(([k, x]) => `${k}=${x}`).join("; ")]);
        break;
      case "verify":
        if (v === false) req.insecure = true;
        else if (typeof v === "string") req.unmapped.push({ option: "verify=<path>", reason: "use --cacert <path> with curl" });
        break;
      case "timeout":
        if (typeof v === "number") req.timeoutSeconds = v;
        break;
      case "allow_redirects":
        req.followRedirects = v !== false;
        break;
      case "proxies": {
        const p = asObject(v, "proxies");
        const first = (p.https ?? p.http) as string | undefined;
        if (typeof first === "string") req.proxy = first;
        break;
      }
      default:
        req.unmapped.push({ option: `${key}=…`, reason: key === "files" ? "file uploads from Python are not converted back; use -F name=@path" : "not converted" });
    }
  }
  if (req.method === "GET" && req.body) req.warnings.push("A GET request with a body: curl sends it with -X GET.");
  return req;
}

/** JavaScript fetch snippet → Request. */
export function fromFetch(src: string): Request {
  const { vars, call } = scan(src, "js", /^(window\.)?fetch$/);
  const req = emptyRequest();
  req.followRedirects = true;
  req.url = asString(resolve(call.args[0] ?? "", vars), "The URL");
  if (!req.url) throw new ConvertError("fetch is called without a URL.");
  const opts = call.args[1] !== undefined ? asObject(resolve(call.args[1], vars), "The fetch options") : {};
  for (const [key, raw] of Object.entries(opts)) {
    const v = resolve(raw as Val, vars);
    switch (key) {
      case "method":
        req.method = asString(v, "method").toUpperCase();
        break;
      case "headers": {
        const h = v && typeof v === "object" && "$call" in (v as object) && (v as { $call: string }).$call === "Headers" ? resolve((v as { args: Val[] }).args[0], vars) : v;
        req.headers.push(...pairsOf(h, "headers"));
        break;
      }
      case "body":
        if (typeof v === "string") req.body = { kind: "raw", text: v };
        else if (v && typeof v === "object" && "$call" in v) {
          const c = v as { $call: string; args: Val[] };
          if (c.$call === "JSON.stringify") {
            const value = new Reader("", "js").plain(resolve(c.args[0], vars), "JSON.stringify");
            req.body = { kind: "json", text: JSON.stringify(value), value };
          } else if (c.$call === "URLSearchParams") req.body = { kind: "form", fields: pairsOf(resolve(c.args[0] ?? {}, vars), "URLSearchParams") };
          else throw new ConvertError(`body: ${c.$call}(…) is not supported. Use a string, JSON.stringify({…}) or new URLSearchParams({…}).`);
        } else throw new ConvertError("body must be a string, JSON.stringify({…}) or new URLSearchParams({…}). FormData built with append() is not supported.");
        break;
      case "redirect":
        req.followRedirects = v !== "manual" && v !== "error";
        break;
      case "credentials":
      case "mode":
      case "cache":
      case "referrerPolicy":
      case "keepalive":
      case "priority":
        req.unmapped.push({ option: `${key}: …`, reason: "a browser-only fetch option with no curl equivalent" });
        break;
      case "signal":
        req.unmapped.push({ option: "signal", reason: "use curl's --max-time for a timeout" });
        break;
      default:
        req.unmapped.push({ option: `${key}: …`, reason: "not converted" });
    }
  }
  if (req.body && req.method === "GET") req.method = "POST";
  return req;
}

/** Request → a curl command, one option per line. */
export function toCurl(req: Request): string {
  const parts: string[] = ["curl"];
  const defaultMethod = req.body ? "POST" : "GET";
  if (req.method === "HEAD") parts.push("--head");
  else if (req.method !== defaultMethod) parts.push(`-X ${req.method}`);
  parts.push(shellQuote(req.url));
  for (const [k, v] of req.headers) parts.push(`-H ${shellQuote(`${k}: ${v}`)}`);
  if (req.auth) parts.push(`-u ${shellQuote(`${req.auth.user}:${req.auth.password}`)}`);
  const b = req.body;
  if (b?.kind === "json") {
    const hasType = req.headers.some(([k]) => k.toLowerCase() === "content-type");
    parts.push(hasType ? `--data-raw ${shellQuote(b.text)}` : `--json ${shellQuote(b.text)}`);
  } else if (b?.kind === "form") for (const [k, v] of b.fields) parts.push(`--data-urlencode ${shellQuote(`${k}=${v}`)}`);
  else if (b?.kind === "raw") parts.push(`--data-raw ${shellQuote(b.text)}`);
  else if (b?.kind === "file") parts.push(`--data-binary ${shellQuote("@" + b.path)}`);
  else if (b?.kind === "multipart") for (const p of b.parts) parts.push(`-F ${shellQuote(`${p.name}=${p.file ? "@" : ""}${p.value}`)}`);
  if (req.followRedirects) parts.push("-L");
  if (req.insecure) parts.push("-k");
  if (req.timeoutSeconds !== null) parts.push(`--max-time ${req.timeoutSeconds}`);
  if (req.proxy) parts.push(`-x ${shellQuote(req.proxy)}`);
  return parts.join(" \\\n  ") + "\n";
}
