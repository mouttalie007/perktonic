import { describe, expect, it } from "vitest";
import { convert, detectInput } from "../src/logic/convert";
import { parseCurl } from "../src/logic/curl";
import { generate } from "../src/logic/generate";
import { ConvertError } from "../src/logic/model";
import { fromFetch, fromPython, toCurl } from "../src/logic/reverse";
import { shellQuote, splitShell } from "../src/logic/shell";
import { EXAMPLES } from "../fixtures/examples";

const code = (cmd: string, target: Parameters<typeof generate>[1]) => generate(parseCurl(cmd), target).code;

describe("shell parsing", () => {
  it("handles backslash continuations, $'…' quoting and mixed quotes", () => {
    const { words } = splitShell(`curl \\\n  -H $'X-Note: line1\\nline2' \\\n  -d "say \\"hi\\"" 'https://a.example/x?y=1&z=2'`);
    expect(words).toEqual(["curl", "-H", "X-Note: line1\nline2", "-d", 'say "hi"', "https://a.example/x?y=1&z=2"]);
    expect(splitShell("curl 'it'\\''s'").words[1]).toBe("it's");
  });

  it("refuses pipes and command substitution, and warns about variables", () => {
    expect(() => parseCurl("curl https://a.example | jq .")).toThrow(/pipes/);
    expect(() => parseCurl('curl -H "Authorization: $(cat token)" https://a.example')).toThrow(/Command substitution/);
    expect(parseCurl('curl -H "Authorization: Bearer $TOKEN" https://a.example').warnings[0]).toMatch(/\$TOKEN are kept as literal text/);
    expect(shellQuote("it's")).toBe("'it'\\''s'");
  });
});

describe("curl options", () => {
  it("keeps multiple -H, JSON bodies and the method", () => {
    const req = parseCurl(EXAMPLES[0].text);
    expect(req.method).toBe("POST");
    expect(req.headers).toEqual([["Authorization", "Bearer sk_test_51Hx9"], ["Content-Type", "application/json"]]);
    expect(req.body).toMatchObject({ kind: "json", value: { customer_id: 4182, gift: false, note: null } });
    expect(code(EXAMPLES[0].text, "python")).toContain('json_data = {\n    "customer_id": 4182,');
    expect(code(EXAMPLES[0].text, "python")).toContain('"gift": False,\n    "note": None,');
  });

  it("treats -d without a content type as form data, joins several -d and encodes --data-urlencode", () => {
    const req = parseCurl(EXAMPLES[1].text);
    expect(req.body).toEqual({ kind: "form", fields: [["comment", "Hello & welcome"], ["team", "ops"]] });
    expect(req.auth).toEqual({ user: "admin", password: "s3cr3t!" });
    expect(req.followRedirects).toBe(true);
    expect(code(EXAMPLES[1].text, "python")).toContain('requests.post(url, data=data, auth=("admin", "s3cr3t!"))');
    expect(code(EXAMPLES[1].text, "fetch")).toContain('Authorization: "Basic " + btoa("admin:s3cr3t!")');
  });

  it("warns when JSON is sent without a Content-Type, like curl actually does", () => {
    const req = parseCurl(`curl -d '{"a":1}' https://a.example`);
    expect(req.body).toEqual({ kind: "raw", text: '{"a":1}' });
    expect(req.headers).toEqual([["Content-Type", "application/x-www-form-urlencoded"]]);
    expect(req.warnings[0]).toMatch(/looks like JSON/);
    const json = parseCurl(`curl --json '{"a":1}' https://a.example`);
    expect(json.headers).toEqual([["Content-Type", "application/json"], ["Accept", "application/json"]]);
  });

  it("builds multipart -F with files and types in every language", () => {
    const req = parseCurl(EXAMPLES[2].text);
    expect(req.body).toEqual({ kind: "multipart", parts: [{ name: "title", value: "Q3 report", file: false }, { name: "file", value: "./report.pdf", file: true, contentType: "application/pdf" }] });
    expect(code(EXAMPLES[2].text, "python")).toContain('("file", ("report.pdf", open("./report.pdf", "rb"), "application/pdf"))');
    expect(code(EXAMPLES[2].text, "fetch")).toContain('form.append("file", await openAsBlob("./report.pdf", { type: "application/pdf" }), "report.pdf");');
    expect(code(EXAMPLES[2].text, "php")).toContain("'file' => new CURLFile('./report.pdf', 'application/pdf', 'report.pdf')");
    expect(code(EXAMPLES[2].text, "go")).toContain('req.Header.Set("Content-Type", mw.FormDataContentType())');
    expect(() => parseCurl("curl -F a=1 -d b=2 https://a.example")).toThrow(/cannot be used in the same/);
  });

  it("applies -X override, -L, -k (with a warning), -G and timeouts", () => {
    const req = parseCurl("curl -XPUT -kL --max-time 7.5 -G -d q=mug -d page=2 https://shop.example/api");
    expect(req.method).toBe("PUT");
    expect(req.url).toBe("https://shop.example/api?q=mug&page=2");
    expect(req.body).toBeNull();
    expect(req.insecure && req.followRedirects).toBe(true);
    expect(req.warnings.join(" ")).toMatch(/-k turns off TLS certificate checks/);
    expect(code("curl -k https://a.example", "go")).toContain("InsecureSkipVerify: true");
    expect(code("curl -k https://a.example", "php")).toContain("CURLOPT_SSL_VERIFYPEER => false");
    expect(generate(parseCurl("curl -k https://a.example"), "fetch").notes[0]).toMatch(/fetch cannot skip certificate checks/);
    expect(code("curl -m 7.5 https://a.example", "go")).toContain("Timeout: 7500 * time.Millisecond,");
    expect(code("curl -L https://a.example", "php")).toContain("CURLOPT_FOLLOWLOCATION => true");
  });

  it("lists every option it cannot map", () => {
    const req = parseCurl("curl -o out.html --retry 3 --http2 -c jar.txt -f https://a.example");
    expect(req.unmapped.map((u) => u.option)).toEqual(["-o out.html", "--retry 3", "--http2", "-c jar.txt", "-f"]);
    expect(req.unmapped[2].reason).toMatch(/HTTP version/);
    expect(parseCurl("curl -s -S -v https://a.example").unmapped).toEqual([]);
  });

  it("drops Accept-Encoding copied from a browser and explains errors", () => {
    const g = generate(parseCurl(`curl 'https://a.example' -H 'accept-encoding: gzip, deflate, br, zstd' --compressed`), "go");
    expect(g.code).not.toContain("accept-encoding");
    expect(g.notes[0]).toMatch(/Accept-Encoding was left out/);
    expect(() => parseCurl("wget https://a.example")).toThrow(/not curl/);
    expect(() => parseCurl("curl -X POST")).toThrow(/No URL/);
    expect(() => parseCurl("curl -H")).toThrow(/needs a value/);
    expect(() => parseCurl("curl 'https://a.example")).toThrow(/not closed/);
  });

  it("writes PHP strings that never interpolate and Go raw strings for JSON", () => {
    expect(code(`curl -d 'price=$5' https://a.example`, "php")).toContain("'price' => '$5'");
    expect(code(EXAMPLES[0].text, "go")).toContain('body := strings.NewReader(`{"customer_id": 4182');
  });
});

describe("reverse direction", () => {
  it("turns Python requests into curl, resolving variables and params", () => {
    const r = convert(EXAMPLES[3].text, "python");
    expect(r.direction).toBe("to-curl");
    if (r.direction === "to-curl") expect(r.curl).toBe("curl \\\n  'https://api.example.com/search?q=coffee+mugs&page=2' \\\n  -H 'Accept: application/json' \\\n  -H 'X-Api-Key: abc123' \\\n  -L \\\n  --max-time 10\n");
    const post = fromPython(`import requests, json\npayload = {"name": "Ada", "admin": True}\nr = requests.post("https://a.example/users", data=json.dumps(payload), auth=("u", "p"), verify=False)`);
    expect(post.body).toMatchObject({ kind: "json", value: { name: "Ada", admin: true } });
    expect(toCurl(post)).toContain("-u u:p");
    expect(toCurl(post)).toContain("-k");
  });

  it("turns fetch into curl, and says what is not supported", () => {
    const req = fromFetch(`const res = await fetch("https://a.example/v1/items", {\n  method: "PATCH",\n  headers: { "Content-Type": "application/json", Authorization: "Bearer t0k" },\n  body: JSON.stringify({ qty: 3, tags: ["x"] }),\n  credentials: "include",\n});`);
    expect(toCurl(req)).toBe("curl \\\n  -X PATCH \\\n  https://a.example/v1/items \\\n  -H 'Content-Type: application/json' \\\n  -H 'Authorization: Bearer t0k' \\\n  --data-raw '{\"qty\":3,\"tags\":[\"x\"]}' \\\n  -L\n");
    expect(req.unmapped[0].option).toBe("credentials: …");
    expect(() => fromFetch("fetch(url)")).toThrow(/variable url is not defined/);
    expect(() => fromFetch("const f = new FormData(); fetch('https://a.example', { method: 'POST', body: f })")).toThrow(/FormData|cannot evaluate|not supported/);
    expect(() => convert("axios.get('https://a.example')", "python")).toThrow(ConvertError);
    expect(detectInput("requests.get('https://x')")).toBe("python");
  });
});

describe("limits and auth", () => {
  it("keeps -u basic auth in every target and refuses input over 5 MB", () => {
    const cmd = EXAMPLES[1].text;
    expect(generate(parseCurl(cmd), "python").code).toContain('auth=("admin", "s3cr3t!")');
    expect(generate(parseCurl(cmd), "fetch").code).toContain('btoa("admin:s3cr3t!")');
    expect(generate(parseCurl(cmd), "axios").code).toContain('username: "admin"');
    expect(generate(parseCurl(cmd), "php").code).toContain("CURLOPT_USERPWD => 'admin:s3cr3t!'");
    expect(generate(parseCurl(cmd), "go").code).toContain('req.SetBasicAuth("admin", "s3cr3t!")');
    expect(toCurl(parseCurl(cmd))).toContain("-u 'admin:s3cr3t!'");
    const huge = "curl https://a.example -d '" + "x".repeat(5 * 1024 * 1024) + "'";
    expect(() => convert(huge, "python")).toThrow(/limit is 5 MB/);
  });
});
