import { goRaw, goStr, indent, jsKey, jsStr, jsValue, phpStr, pyStr, pyValue } from "./literals";
import type { Part, Request } from "./model";

export type Target = "python" | "fetch" | "axios" | "php" | "go";

export const TARGETS: { id: Target; label: string; ext: string }[] = [
  { id: "python", label: "Python (requests)", ext: "py" },
  { id: "fetch", label: "JavaScript (fetch)", ext: "js" },
  { id: "axios", label: "JavaScript (axios)", ext: "js" },
  { id: "php", label: "PHP (cURL)", ext: "php" },
  { id: "go", label: "Go (net/http)", ext: "go" },
];

export interface Generated {
  code: string;
  /** Things the reader should know about this particular translation. */
  notes: string[];
}

/**
 * Headers worth writing into code. Accept-Encoding is dropped because every
 * target negotiates and decodes compression itself (setting it by hand makes
 * Go and Python return compressed bytes); Content-Type is dropped for
 * multipart bodies because the library must add the boundary.
 */
function codeHeaders(req: Request, notes: string[]): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of req.headers) {
    const lk = k.toLowerCase();
    if (lk === "accept-encoding") {
      if (!notes.some((n) => n.startsWith("Accept-Encoding"))) notes.push("Accept-Encoding was left out: the library asks for compression and decompresses the response itself.");
      continue;
    }
    if (lk === "content-type" && req.body?.kind === "multipart") continue;
    if (lk === "content-length") continue;
    out.push([k, v]);
  }
  return out;
}

const methodCall = (m: string) => ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(m);

function partFilename(p: Part): string {
  return p.filename ?? p.value.split(/[\\/]/).pop() ?? "file";
}

export function toPython(req: Request): Generated {
  const notes: string[] = [];
  const lines = ["import requests", ""];
  const args: string[] = [];
  lines.push(`url = ${pyStr(req.url)}`);
  const headers = codeHeaders(req, notes);
  if (headers.length) {
    const dup = new Set(headers.map(([k]) => k.toLowerCase())).size !== headers.length;
    if (dup) notes.push("requests keeps one value per header name; repeated headers were joined with “, ”.");
    const merged = new Map<string, [string, string]>();
    for (const [k, v] of headers) {
      const prev = merged.get(k.toLowerCase());
      merged.set(k.toLowerCase(), prev ? [prev[0], `${prev[1]}, ${v}`] : [k, v]);
    }
    lines.push("headers = {", ...[...merged.values()].map(([k, v]) => `    ${pyStr(k)}: ${pyStr(v)},`), "}");
    args.push("headers=headers");
  }
  const b = req.body;
  if (b?.kind === "json") {
    lines.push(`json_data = ${pyValue(b.value)}`);
    args.push("json=json_data");
  } else if (b?.kind === "form") {
    const dup = new Set(b.fields.map(([k]) => k)).size !== b.fields.length;
    if (dup) lines.push("data = [", ...b.fields.map(([k, v]) => `    (${pyStr(k)}, ${pyStr(v)}),`), "]");
    else lines.push("data = {", ...b.fields.map(([k, v]) => `    ${pyStr(k)}: ${pyStr(v)},`), "}");
    args.push("data=data");
  } else if (b?.kind === "raw") {
    lines.push(`data = ${pyStr(b.text)}`);
    args.push("data=data");
  } else if (b?.kind === "file") {
    lines.push(`data = open(${pyStr(b.path)}, "rb")`);
    args.push("data=data");
  } else if (b?.kind === "multipart") {
    lines.push("files = [");
    for (const p of b.parts) {
      if (p.file) lines.push(`    (${pyStr(p.name)}, (${pyStr(partFilename(p))}, open(${pyStr(p.value)}, "rb")${p.contentType ? `, ${pyStr(p.contentType)}` : ""})),`);
      else lines.push(`    (${pyStr(p.name)}, (None, ${pyStr(p.value)})),`);
    }
    lines.push("]");
    args.push("files=files");
  }
  if (req.auth) args.push(`auth=(${pyStr(req.auth.user)}, ${pyStr(req.auth.password)})`);
  if (req.proxy) {
    lines.push(`proxies = {"http": ${pyStr(req.proxy)}, "https": ${pyStr(req.proxy)}}`);
    args.push("proxies=proxies");
  }
  if (req.insecure) args.push("verify=False");
  if (req.timeoutSeconds !== null || req.connectTimeoutSeconds !== null) {
    if (req.connectTimeoutSeconds !== null) args.push(`timeout=(${req.connectTimeoutSeconds}, ${req.timeoutSeconds ?? "None"})`);
    else args.push(`timeout=${req.timeoutSeconds}`);
    if (req.timeoutSeconds !== null) notes.push("requests' timeout limits each wait for data, not the whole download like curl's --max-time.");
  }
  if (req.followRedirects && req.method === "HEAD") args.push("allow_redirects=True");
  if (!req.followRedirects && req.method !== "HEAD") args.push("allow_redirects=False");
  if (!req.followRedirects) notes.push("allow_redirects=False matches curl without -L. Remove it to follow redirects.");
  if (req.maxRedirects !== null) notes.push("--max-redirs: set session.max_redirects on a requests.Session to limit redirects.");
  const call = methodCall(req.method) ? `requests.${req.method.toLowerCase()}(url` : `requests.request(${pyStr(req.method)}, url`;
  lines.push("", `response = ${call}${args.length ? ", " + args.join(", ") : ""})`, "print(response.status_code)", "print(response.text)");
  if (req.insecure) notes.unshift("verify=False disables certificate checks; requests prints an InsecureRequestWarning. Use it only for testing.");
  return { code: lines.join("\n") + "\n", notes };
}

function jsHeadersObject(headers: [string, string][]): string {
  return `{\n${headers.map(([k, v]) => `    ${jsKey(k)}: ${jsStr(v)},`).join("\n")}\n  }`;
}

export function toFetch(req: Request): Generated {
  const notes: string[] = [];
  const pre: string[] = [];
  const opts: string[] = [];
  let headers = codeHeaders(req, notes);
  if (req.auth) {
    headers = [...headers.filter(([k]) => k.toLowerCase() !== "authorization"), ["Authorization", `__BASIC__`]];
  }
  if (req.method !== "GET") opts.push(`method: ${jsStr(req.method)}`);
  if (headers.length) {
    const obj = `{\n${headers.map(([k, v]) => `    ${jsKey(k)}: ${v === "__BASIC__" ? `"Basic " + btoa(${jsStr(`${req.auth!.user}:${req.auth!.password}`)})` : jsStr(v)},`).join("\n")}\n  }`;
    opts.push(`headers: ${obj}`);
  }
  const b = req.body;
  if (b?.kind === "json") opts.push(`body: JSON.stringify(${indent(jsValue(b.value), "  ")})`);
  else if (b?.kind === "form") opts.push(`body: new URLSearchParams([\n${b.fields.map(([k, v]) => `    [${jsStr(k)}, ${jsStr(v)}],`).join("\n")}\n  ])`);
  else if (b?.kind === "raw") opts.push(`body: ${jsStr(b.text)}`);
  else if (b?.kind === "file") {
    pre.push(`import { readFile } from "node:fs/promises";`, "");
    opts.push(`body: await readFile(${jsStr(b.path)})`);
    notes.push("Reading a local file works in Node.js; in a browser, use a File from an <input type=\"file\"> instead.");
  } else if (b?.kind === "multipart") {
    const hasFile = b.parts.some((p) => p.file);
    if (hasFile) pre.push(`import { openAsBlob } from "node:fs";`, "");
    pre.push("const form = new FormData();");
    for (const p of b.parts) {
      if (p.file) pre.push(`form.append(${jsStr(p.name)}, await openAsBlob(${jsStr(p.value)}${p.contentType ? `, { type: ${jsStr(p.contentType)} }` : ""}), ${jsStr(partFilename(p))});`);
      else pre.push(`form.append(${jsStr(p.name)}, ${jsStr(p.value)});`);
    }
    pre.push("");
    opts.push("body: form");
    if (hasFile) notes.push("openAsBlob needs Node.js 20 or later; in a browser, append a File from an <input type=\"file\"> instead.");
  }
  if (!req.followRedirects) {
    opts.push(`redirect: "manual"`);
    notes.push("redirect: \"manual\" matches curl without -L. In a browser this returns an opaque response; remove it to follow redirects.");
  }
  if (req.timeoutSeconds !== null) opts.push(`signal: AbortSignal.timeout(${Math.round(req.timeoutSeconds * 1000)})`);
  if (req.insecure) notes.unshift("fetch cannot skip certificate checks (-k). In Node.js, run with NODE_TLS_REJECT_UNAUTHORIZED=0 for testing only; browsers never allow it.");
  if (req.proxy) notes.push("fetch has no proxy option. In Node.js, pass a dispatcher from undici's ProxyAgent.");
  if (req.connectTimeoutSeconds !== null) notes.push("fetch has no separate connect timeout; AbortSignal.timeout covers the whole request.");
  const forbidden = headers.filter(([k]) => /^(cookie|host|origin|referer|connection|sec-|proxy-)/i.test(k));
  if (forbidden.length) notes.push(`Browsers ignore ${forbidden.map(([k]) => k).join(", ")} in fetch; they work in Node.js.`);
  const call = opts.length ? `await fetch(${jsStr(req.url)}, {\n${opts.map((o) => `  ${o},`).join("\n")}\n})` : `await fetch(${jsStr(req.url)})`;
  const code = [...pre, `const response = ${call};`, "", "console.log(response.status);", "console.log(await response.text());"].join("\n");
  return { code: code + "\n", notes };
}

function parseProxy(p: string): { protocol: string; host: string; port: number } | null {
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(p) ? p : `http://${p}`);
    return { protocol: u.protocol.replace(":", ""), host: u.hostname, port: Number(u.port || (u.protocol === "https:" ? 443 : 1080)) };
  } catch {
    return null;
  }
}

export function toAxios(req: Request): Generated {
  const notes: string[] = [];
  const pre: string[] = [`import axios from "axios";`];
  const opts: string[] = [`method: ${jsStr(req.method.toLowerCase())}`, `url: ${jsStr(req.url)}`];
  const headers = codeHeaders(req, notes);
  if (headers.length) opts.push(`headers: ${jsHeadersObject(headers)}`);
  const b = req.body;
  if (b?.kind === "json") opts.push(`data: ${indent(jsValue(b.value), "  ")}`);
  else if (b?.kind === "form") opts.push(`data: new URLSearchParams([\n${b.fields.map(([k, v]) => `    [${jsStr(k)}, ${jsStr(v)}],`).join("\n")}\n  ])`);
  else if (b?.kind === "raw") opts.push(`data: ${jsStr(b.text)}`);
  else if (b?.kind === "file") {
    pre.push(`import fs from "node:fs";`);
    opts.push(`data: fs.createReadStream(${jsStr(b.path)})`);
  } else if (b?.kind === "multipart") {
    const hasFile = b.parts.some((p) => p.file);
    if (hasFile) pre.push(`import { openAsBlob } from "node:fs";`);
    pre.push("", "const form = new FormData();");
    for (const p of b.parts) {
      if (p.file) pre.push(`form.append(${jsStr(p.name)}, await openAsBlob(${jsStr(p.value)}${p.contentType ? `, { type: ${jsStr(p.contentType)} }` : ""}), ${jsStr(partFilename(p))});`);
      else pre.push(`form.append(${jsStr(p.name)}, ${jsStr(p.value)});`);
    }
    opts.push("data: form");
  }
  if (req.auth) opts.push(`auth: {\n    username: ${jsStr(req.auth.user)},\n    password: ${jsStr(req.auth.password)},\n  }`);
  if (req.timeoutSeconds !== null) opts.push(`timeout: ${Math.round(req.timeoutSeconds * 1000)}`);
  if (!req.followRedirects) {
    opts.push("maxRedirects: 0");
    notes.push("maxRedirects: 0 matches curl without -L (Node.js only; browsers always follow).");
  } else if (req.maxRedirects !== null) opts.push(`maxRedirects: ${req.maxRedirects}`);
  if (req.proxy) {
    const p = parseProxy(req.proxy);
    if (p) opts.push(`proxy: { protocol: ${jsStr(p.protocol)}, host: ${jsStr(p.host)}, port: ${p.port} }`);
  }
  if (req.insecure) {
    pre.splice(1, 0, `import https from "node:https";`);
    opts.push("httpsAgent: new https.Agent({ rejectUnauthorized: false })");
    notes.unshift("rejectUnauthorized: false disables certificate checks (Node.js only). Use it only for testing.");
  }
  opts.push("validateStatus: () => true");
  notes.push("validateStatus: () => true returns 4xx/5xx responses instead of throwing, like curl.");
  const code = [...pre, "", `const response = await axios({\n${opts.map((o) => `  ${o},`).join("\n")}\n});`, "", "console.log(response.status);", "console.log(response.data);"].join("\n");
  return { code: code + "\n", notes };
}

export function toPhp(req: Request): Generated {
  const notes: string[] = [];
  const opts: string[] = [`CURLOPT_URL => ${phpStr(req.url)}`, "CURLOPT_RETURNTRANSFER => true"];
  if (req.method === "HEAD") opts.push("CURLOPT_NOBODY => true");
  else if (req.method === "POST" && req.body) {
    // CURLOPT_POSTFIELDS alone makes PHP send POST, like curl -d.
  } else if (req.method !== "GET") opts.push(`CURLOPT_CUSTOMREQUEST => ${phpStr(req.method)}`);
  const headers = codeHeaders(req, notes);
  if (headers.length) opts.push(`CURLOPT_HTTPHEADER => [\n${headers.map(([k, v]) => `        ${phpStr(`${k}: ${v}`)},`).join("\n")}\n    ]`);
  const b = req.body;
  const pre: string[] = [];
  if (b?.kind === "json" || b?.kind === "raw") opts.push(`CURLOPT_POSTFIELDS => ${phpStr(b.text)}`);
  else if (b?.kind === "form") {
    const dup = new Set(b.fields.map(([k]) => k)).size !== b.fields.length;
    if (dup) opts.push(`CURLOPT_POSTFIELDS => ${phpStr(b.fields.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&"))}`);
    else opts.push(`CURLOPT_POSTFIELDS => http_build_query([\n${b.fields.map(([k, v]) => `        ${phpStr(k)} => ${phpStr(v)},`).join("\n")}\n    ])`);
  } else if (b?.kind === "file") opts.push(`CURLOPT_POSTFIELDS => file_get_contents(${phpStr(b.path)})`);
  else if (b?.kind === "multipart") {
    opts.push(`CURLOPT_POSTFIELDS => [\n${b.parts.map((p) => `        ${phpStr(p.name)} => ${p.file ? `new CURLFile(${phpStr(p.value)}, ${phpStr(p.contentType ?? "")}, ${phpStr(partFilename(p))})` : phpStr(p.value)},`).join("\n")}\n    ]`);
  }
  if (req.auth) opts.push(`CURLOPT_USERPWD => ${phpStr(`${req.auth.user}:${req.auth.password}`)}`);
  if (req.followRedirects) opts.push("CURLOPT_FOLLOWLOCATION => true");
  if (req.maxRedirects !== null) opts.push(`CURLOPT_MAXREDIRS => ${req.maxRedirects}`);
  if (req.compressed) opts.push("CURLOPT_ENCODING => ''");
  if (req.timeoutSeconds !== null) opts.push(`CURLOPT_TIMEOUT => ${req.timeoutSeconds}`);
  if (req.connectTimeoutSeconds !== null) opts.push(`CURLOPT_CONNECTTIMEOUT => ${req.connectTimeoutSeconds}`);
  if (req.proxy) opts.push(`CURLOPT_PROXY => ${phpStr(req.proxy)}`);
  if (req.insecure) {
    opts.push("CURLOPT_SSL_VERIFYPEER => false", "CURLOPT_SSL_VERIFYHOST => 0");
    notes.unshift("CURLOPT_SSL_VERIFYPEER => false disables certificate checks. Use it only for testing.");
  }
  const code = [
    "<?php",
    "",
    ...pre,
    "$ch = curl_init();",
    `curl_setopt_array($ch, [\n${opts.map((o) => `    ${o},`).join("\n")}\n]);`,
    "",
    "$response = curl_exec($ch);",
    "if ($response === false) {",
    "    echo 'Request failed: ' . curl_error($ch) . PHP_EOL;",
    "} else {",
    "    echo curl_getinfo($ch, CURLINFO_RESPONSE_CODE) . PHP_EOL;",
    "    echo $response . PHP_EOL;",
    "}",
  ].join("\n");
  return { code: code + "\n", notes };
}

export function toGo(req: Request): Generated {
  const notes: string[] = [];
  const imports = new Set(["fmt", "io", "log", "net/http"]);
  const body: string[] = [];
  let bodyVar = "nil";
  const b = req.body;
  if (b?.kind === "json" || b?.kind === "raw") {
    imports.add("strings");
    body.push(`\tbody := strings.NewReader(${goRaw(b.text)})`);
    bodyVar = "body";
  } else if (b?.kind === "form") {
    imports.add("net/url");
    imports.add("strings");
    body.push("\tform := url.Values{}");
    for (const [k, v] of b.fields) body.push(`\tform.Add(${goStr(k)}, ${goStr(v)})`);
    body.push("\tbody := strings.NewReader(form.Encode())");
    bodyVar = "body";
  } else if (b?.kind === "file") {
    imports.add("os");
    body.push(`\tbody, err := os.Open(${goStr(b.path)})`, "\tif err != nil {", "\t\tlog.Fatal(err)", "\t}", "\tdefer body.Close()");
    bodyVar = "body";
  } else if (b?.kind === "multipart") {
    imports.add("bytes");
    imports.add("mime/multipart");
    body.push("\tvar buf bytes.Buffer", "\tmw := multipart.NewWriter(&buf)");
    for (const p of b.parts) {
      if (p.file) {
        imports.add("os");
        if (p.contentType) {
          imports.add("net/textproto");
          body.push("\t{", "\t\th := make(textproto.MIMEHeader)", `\t\th.Set("Content-Disposition", ${goStr(`form-data; name="${p.name}"; filename="${partFilename(p)}"`)})`, `\t\th.Set("Content-Type", ${goStr(p.contentType)})`, "\t\tw, err := mw.CreatePart(h)");
        } else body.push("\t{", `\t\tw, err := mw.CreateFormFile(${goStr(p.name)}, ${goStr(partFilename(p))})`);
        body.push("\t\tif err != nil {", "\t\t\tlog.Fatal(err)", "\t\t}", `\t\tf, err := os.Open(${goStr(p.value)})`, "\t\tif err != nil {", "\t\t\tlog.Fatal(err)", "\t\t}", "\t\tif _, err := io.Copy(w, f); err != nil {", "\t\t\tlog.Fatal(err)", "\t\t}", "\t\tf.Close()", "\t}");
      } else body.push(`\tif err := mw.WriteField(${goStr(p.name)}, ${goStr(p.value)}); err != nil {`, "\t\tlog.Fatal(err)", "\t}");
    }
    body.push("\tif err := mw.Close(); err != nil {", "\t\tlog.Fatal(err)", "\t}");
    bodyVar = "&buf";
  }
  const lines: string[] = [...body];
  lines.push(`\treq, err := http.NewRequest(${goStr(req.method)}, ${goStr(req.url)}, ${bodyVar})`, "\tif err != nil {", "\t\tlog.Fatal(err)", "\t}");
  for (const [k, v] of codeHeaders(req, notes)) lines.push(`\treq.Header.Add(${goStr(k)}, ${goStr(v)})`);
  if (b?.kind === "multipart") lines.push("\treq.Header.Set(\"Content-Type\", mw.FormDataContentType())");
  if (req.auth) lines.push(`\treq.SetBasicAuth(${goStr(req.auth.user)}, ${goStr(req.auth.password)})`);

  const client: string[] = [];
  const transport: string[] = [];
  if (req.insecure) {
    imports.add("crypto/tls");
    transport.push("\t\tTLSClientConfig: &tls.Config{InsecureSkipVerify: true},");
    notes.unshift("InsecureSkipVerify disables certificate checks. Use it only for testing.");
  }
  if (req.proxy) {
    imports.add("net/url");
    lines.unshift(`\tproxyURL, err := url.Parse(${goStr(req.proxy)})`, "\tif err != nil {", "\t\tlog.Fatal(err)", "\t}");
    transport.push("\t\tProxy: http.ProxyURL(proxyURL),");
  }
  if (transport.length) client.push("\t\tTransport: &http.Transport{", ...transport.map((t) => "\t" + t), "\t\t},");
  if (req.timeoutSeconds !== null) {
    imports.add("time");
    client.push(`\t\tTimeout: ${Number.isInteger(req.timeoutSeconds) ? `${req.timeoutSeconds} * time.Second` : `${Math.round(req.timeoutSeconds * 1000)} * time.Millisecond`},`);
  }
  if (!req.followRedirects) {
    client.push("\t\tCheckRedirect: func(req *http.Request, via []*http.Request) error {", "\t\t\treturn http.ErrUseLastResponse", "\t\t},");
    notes.push("CheckRedirect returning http.ErrUseLastResponse matches curl without -L. Remove it to follow redirects.");
  } else if (req.maxRedirects !== null) {
    imports.add("errors");
    client.push("\t\tCheckRedirect: func(req *http.Request, via []*http.Request) error {", `\t\t\tif len(via) >= ${req.maxRedirects} {`, "\t\t\t\treturn errors.New(\"too many redirects\")", "\t\t\t}", "\t\t\treturn nil", "\t\t},");
  }
  if (req.connectTimeoutSeconds !== null) notes.push("For a connect timeout, set a net.Dialer with Timeout in the Transport.");
  lines.push(client.length ? `\tclient := &http.Client{\n${client.join("\n")}\n\t}` : "\tclient := &http.Client{}");
  lines.push("\tresp, err := client.Do(req)", "\tif err != nil {", "\t\tlog.Fatal(err)", "\t}", "\tdefer resp.Body.Close()", "\trespBody, err := io.ReadAll(resp.Body)", "\tif err != nil {", "\t\tlog.Fatal(err)", "\t}", "\tfmt.Println(resp.Status)", "\tfmt.Println(string(respBody))");
  const sorted = [...imports].sort();
  const code = ["package main", "", "import (", ...sorted.map((i) => `\t"${i}"`), ")", "", "func main() {", ...lines, "}"].join("\n");
  return { code: code + "\n", notes };
}

export function generate(req: Request, target: Target): Generated {
  switch (target) {
    case "python":
      return toPython(req);
    case "fetch":
      return toFetch(req);
    case "axios":
      return toAxios(req);
    case "php":
      return toPhp(req);
    case "go":
      return toGo(req);
  }
}
