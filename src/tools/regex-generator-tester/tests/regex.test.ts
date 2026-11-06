import { Worker } from "node:worker_threads";
import { describe, expect, it } from "vitest";
import { analyze, PatternError } from "../src/logic/explain";
import { jsLiteral, toFlavor } from "../src/logic/flavors";
import { findMatches, matchesCsv, segments } from "../src/logic/match";
import { MAX_MATCHES, TIMEOUT_MS } from "../src/logic/types";
import { EXAMPLE, LIBRARY, SLOW } from "../fixtures/library";

const steps = (p: string, f = "") => analyze(p, f).steps.map((s) => `${"  ".repeat(s.depth)}${s.text}`);

describe("explanation", () => {
  it("explains a pattern token by token, with named groups", () => {
    expect(steps(String.raw`^(?<year>\d{4})-v\.[^a-z0-9_]?$`)).toEqual([
      "the start of the text (or of a line with the m flag)",
      "Capture group 1, named “year”:",
      "  Repeat exactly 4 times, as many as possible:",
      "    a digit (0–9)",
      "the text “-v.”",
      "Repeat optionally (zero or one time), as many as possible:",
      "  one character that is NOT: “a” to “z”, “0” to “9”, “_”",
      "the end of the text (or of a line with the m flag)",
    ]);
    const a = analyze(EXAMPLE.pattern, EXAMPLE.flags);
    expect(a.groups.map((g) => g.name)).toEqual(["date", "time", "level", "message"]);
    expect(steps("cat|dog")).toEqual(["Either this alternative (1 of 2):", "  the text “cat”", "Or alternative 2 of 2:", "  the text “dog”"]);
    expect(steps(String.raw`(?<=\$)\d+?`)[2]).toBe("Repeat one or more times, as few as possible (lazy):");
  });

  it("reports syntax errors in plain words with their position", () => {
    const cases: [string, RegExp, number][] = [
      ["(abc", /“\(” is never closed/, 4],
      ["abc)", /“\)” has no matching “\(”/, 3],
      ["[a-z", /“\[” is never closed/, 4],
      ["*abc", /nothing before it to repeat/, 1],
      ["[z-a]", /backwards/, 4],
    ];
    for (const [p, re, index] of cases) {
      try {
        analyze(p, "");
        throw new Error(`no error for ${p}`);
      } catch (e) {
        expect(e).toBeInstanceOf(PatternError);
        expect((e as PatternError).message, p).toMatch(re);
        expect((e as PatternError).index, p).toBe(index);
      }
    }
  });

  it("flags catastrophic backtracking risks such as (a+)+", () => {
    expect(analyze(SLOW.pattern, "").risks[0]).toMatch(/^\(a\+\)\+: a repeated group/);
    expect(analyze(String.raw`(\w+\s?)*$`, "").risks).toHaveLength(1);
    expect(analyze(String.raw`(\d{3})+`, "").risks).toHaveLength(0);
  });
});

describe("matching", () => {
  it("finds every match with numbered and named groups and their positions", () => {
    const r = findMatches(EXAMPLE.pattern, EXAMPLE.flags, EXAMPLE.text, null);
    expect(r.matches.map((m) => m.named.level)).toEqual(["WARN", "ERROR", "ERROR"]);
    expect(r.matches[1].named.message).toBe("Payment webhook failed: timeout after 10s");
    expect(r.matches[0].groups[0]).toEqual({ text: "2026-10-28", start: 55, end: 65 });
    expect(findMatches("o", "", "foo boo", null).matches).toHaveLength(1);
    expect(findMatches("o", "gi", "fOo boo", null).matches.map((m) => m.index)).toEqual([1, 2, 5, 6]);
  });

  it("handles empty matches, optional groups, sticky mode, the match cap and replacement", () => {
    expect(findMatches("a*", "g", "baa", null).matches.map((m) => [m.index, m.text])).toEqual([[0, ""], [1, "aa"], [3, ""]]);
    expect(findMatches("(x)?y", "g", "y", null).matches[0].groups).toEqual([null]);
    expect(findMatches("a", "y", "ba", null).matches).toHaveLength(0);
    expect(findMatches("\\d", "g", "1".repeat(MAX_MATCHES + 5), null)).toMatchObject({ capped: true });
    expect(findMatches("(\\w+)@(\\w+)", "g", "a@b c@d", "$2 at $1").replaced).toBe("b at a d at c");
    expect(findMatches("😀", "gu", "a😀b", null).matches[0]).toMatchObject({ index: 1, end: 3 });
  });

  it("splits text into highlight segments, cut at the display limit", () => {
    const r = findMatches("o+", "g", "foo boo", null);
    expect(segments("foo boo", r.matches, 100)).toEqual([
      { text: "f", match: null },
      { text: "oo", match: 0 },
      { text: " b", match: null },
      { text: "oo", match: 1 },
    ]);
    expect(segments("foo boo", r.matches, 2)).toEqual([{ text: "f", match: null }, { text: "o", match: 0 }]);
    const csv = matchesCsv(findMatches("(=\\w+)", "g", "=SUM", null).matches, [null]);
    expect(csv).toBe("\uFEFF#,start,end,match,group 1\r\n1,0,4,'=SUM,'=SUM\r\n");
  });

  it("stops a catastrophically backtracking pattern with a worker timeout", async () => {
    const w = new Worker(new URL("./slow-worker.mjs", import.meta.url), { workerData: SLOW });
    const outcome = await new Promise<string>((resolve) => {
      const timer = setTimeout(() => {
        void w.terminate();
        resolve("timeout");
      }, TIMEOUT_MS);
      w.on("message", () => {
        clearTimeout(timer);
        resolve("finished");
      });
    });
    expect(outcome).toBe("timeout");
  }, 10_000);
});

describe("flavours", () => {
  it("rewrites named groups and backreferences for Python and lists differences", () => {
    const a = analyze(String.raw`(?<word>\w+)\s+\k<word>\u{1F600}`, "u");
    const py = toFlavor(String.raw`(?<word>\w+)\s+\k<word>\u{1F600}`, "u", a.features, "python");
    expect(py.pattern).toBe(String.raw`(?P<word>\w+)\s+(?P=word)\U0001F600`);
    expect(py.code).toBe(`import re\n\npattern = re.compile(r"(?P<word>\\w+)\\s+(?P=word)\\U0001F600")\nm = pattern.search(text)\n`);
    expect(py.notes[0]).toMatch(/Unicode digits/);
    const lb = analyze(String.raw`(?<=\$|USD )\d+`, "");
    expect(toFlavor(String.raw`(?<=\$|USD )\d+`, "", lb.features, "python").problems[0]).toMatch(/fixed-width lookbehind/);
    const prop = analyze(String.raw`\p{L}+`, "u");
    expect(toFlavor(String.raw`\p{L}+`, "u", prop.features, "python").problems[0]).toMatch(/no \\p\{…\}/);
  });

  it("reports what Go, Java and PCRE cannot do, and writes their code", () => {
    const src = String.raw`(?<first_name>\w+)(?=\s)\1[^]`;
    const a = analyze(src, "gi");
    const go = toFlavor(src, "gi", a.features, "go");
    expect(go.problems.join(" ")).toMatch(/no lookahead or lookbehind[\s\S]*no backreferences/);
    expect(go.code).toBe("re := regexp.MustCompile(`(?i)(?P<first_name>\\w+)(?=\\s)\\1[\\s\\S]`)\nmatches := re.FindAllStringSubmatch(text, -1)\n");
    const java = toFlavor(src, "gi", a.features, "java");
    expect(java.problems[0]).toMatch(/Java group names .* “first_name”/);
    expect(java.code.split("\n")[0]).toBe('Pattern pattern = Pattern.compile("(?<first_name>\\\\w+)(?=\\\\s)\\\\1[\\\\s\\\\S]", Pattern.CASE_INSENSITIVE);');
    const pcre = toFlavor("a/b'c", "g", analyze("a/b'c", "g").features, "pcre");
    expect(pcre.code).toBe("preg_match_all('/a\\\\/b\\'c/', $text, $matches);\n");
    expect(jsLiteral("a/b[/]", "g")).toBe("/a\\/b[/]/g");
  });
});

describe("library", () => {
  it("has 20+ patterns that compile and match their own test text", () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(20);
    for (const p of LIBRARY) {
      expect(() => analyze(p.pattern, p.flags), p.id).not.toThrow();
      const r = findMatches(p.pattern, p.flags, p.test, null);
      expect(r.matches.length, p.id).toBeGreaterThan(0);
      expect(p.explanation.length, p.id).toBeGreaterThan(30);
    }
    const ip = findMatches(LIBRARY.find((p) => p.id === "ipv4")!.pattern, "g", LIBRARY.find((p) => p.id === "ipv4")!.test, null);
    expect(ip.matches.map((m) => m.text)).toEqual(["192.168.1.1", "8.8.8.8"]);
    const mac = LIBRARY.find((p) => p.id === "mac")!;
    expect(findMatches(mac.pattern, mac.flags, mac.test, null).matches).toHaveLength(2);
  });
});
