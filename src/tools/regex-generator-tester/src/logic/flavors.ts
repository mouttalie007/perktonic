import type { AST } from "@eslint-community/regexpp";
import { parseAst, type Features } from "./explain";
import type { Flavor } from "./types";

export interface FlavorResult {
  flavor: Flavor;
  /** The pattern rewritten for that engine (mechanical changes only). */
  pattern: string;
  /** Ready-to-paste code. */
  code: string;
  /** Rewrites that were applied. */
  changes: string[];
  /** Things that will not work in that engine. */
  problems: string[];
  /** Behaviour differences worth knowing. */
  notes: string[];
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

function walk(n: AST.Node, visit: (n: AST.Node) => void) {
  visit(n);
  if ("alternatives" in n) for (const a of n.alternatives) walk(a, visit);
  if ("elements" in n) for (const e of n.elements as AST.Node[]) walk(e, visit);
  if (n.type === "Quantifier") walk(n.element, visit);
}

function hex(cp: number, width: number): string {
  return cp.toString(16).toUpperCase().padStart(width, "0");
}

function applyEdits(source: string, edits: Edit[]): string {
  let out = source;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

function pyString(p: string): string {
  if (!p.endsWith("\\") || /(?:^|[^\\])(?:\\\\)*$/.test(p)) {
    if (!p.includes("\"")) return `r"${p}"`;
    if (!p.includes("'")) return `r'${p}'`;
  }
  return JSON.stringify(p);
}

function javaString(p: string): string {
  return `"${p.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

/** The pattern as a JavaScript literal: an unescaped / outside a class must be escaped. */
export function jsLiteral(source: string, flags: string): string {
  let out = "";
  let inClass = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === "\\") {
      out += c + (source[i + 1] ?? "");
      i++;
      continue;
    }
    if (c === "[") inClass = true;
    else if (c === "]") inClass = false;
    out += c === "/" && !inClass ? "\\/" : c;
  }
  return `/${out || "(?:)"}/${flags}`;
}

const JAVA_NAME = /^[A-Za-z][A-Za-z0-9]*$/;

/**
 * Rewrites a JavaScript pattern for another engine where the change is
 * mechanical (named-group syntax, code point escapes, [^]), and lists what
 * cannot work there. The pattern is only run in JavaScript.
 */
export function toFlavor(source: string, flags: string, f: Features, flavor: Flavor): FlavorResult {
  const ast = parseAst(source, flags);
  const edits: Edit[] = [];
  const changes = new Set<string>();
  const problems: string[] = [];
  const notes: string[] = [];

  walk(ast, (n) => {
    if (n.type === "CapturingGroup" && n.name) {
      const head = `(?<${n.name}>`;
      if (flavor === "python" || flavor === "go") {
        edits.push({ start: n.start, end: n.start + head.length, text: `(?P<${n.name}>` });
        changes.add(flavor === "python" ? "Named groups (?<name>…) became (?P<name>…), the syntax Python's re module requires." : "Named groups (?<name>…) became (?P<name>…), which every Go version accepts (Go 1.22+ also reads (?<name>…)).");
      }
      if (flavor === "java" && !JAVA_NAME.test(n.name)) problems.push(`Java group names may contain only ASCII letters and digits and must start with a letter; rename “${n.name}” (for example to “${n.name.replace(/[^A-Za-z0-9]/g, "") || "g"}”).`);
    }
    if (n.type === "Backreference" && typeof n.ref === "string" && flavor === "python") {
      edits.push({ start: n.start, end: n.end, text: `(?P=${n.ref})` });
      changes.add("Named backreferences \\k<name> became (?P=name).");
    }
    if (n.type === "Character" && (n.raw.startsWith("\\u{") || (n.raw.startsWith("\\u") && flavor !== "python" && flavor !== "java"))) {
      const cp = n.value;
      const text = flavor === "python" ? (cp > 0xffff ? `\\U${hex(cp, 8)}` : `\\u${hex(cp, 4)}`) : flavor === "java" ? `\\x{${hex(cp, 4)}}` : `\\x{${hex(cp, 4)}}`;
      if (text !== n.raw) {
        edits.push({ start: n.start, end: n.end, text });
        changes.add(`Unicode escapes such as ${n.raw} became ${text}.`);
      }
    }
    if (n.type === "CharacterClass" && n.raw === "[^]") {
      edits.push({ start: n.start, end: n.end, text: "[\\s\\S]" });
      changes.add("[^] (any character) is JavaScript-only; it became [\\s\\S].");
    }
    if (n.type === "CharacterSet" && n.kind === "property" && flavor === "go" && n.key === "Script" && n.value) {
      edits.push({ start: n.start, end: n.end, text: `\\${n.negate ? "P" : "p"}{${n.value}}` });
      changes.add("\\p{Script=…} became \\p{…}, Go's form for scripts.");
    }
  });

  if (f.classSetOps) problems.push("Set operations inside classes (v flag: --, &&, \\q{…}) exist only in JavaScript.");
  if (flavor === "go") {
    if (f.lookahead || f.lookbehind) problems.push("Go's RE2 engine has no lookahead or lookbehind. Match more text and check it in code, or use a capture group instead.");
    if (f.backrefs) problems.push("Go's RE2 engine has no backreferences (\\1, \\k<name>). Compare the captured groups in code instead.");
    if (f.unicodeProperty.some((p) => /\{[A-Za-z_]{3,}\}/.test(p) && !/Script/.test(p))) notes.push("Go supports one- and two-letter categories (\\p{L}, \\p{Lu}) and script names (\\p{Greek}); long names such as \\p{Letter} are not accepted.");
  }
  if (flavor === "python") {
    if (f.unicodeProperty.length) problems.push("Python's re module has no \\p{…} classes. Use the third-party regex module (same syntax), or a class such as [^\\W\\d_] for “any letter”.");
    if (f.variableLookbehind) problems.push("Python's re module needs fixed-width lookbehind; this one can match different lengths. Rewrite it as alternatives of one length, or use the regex module.");
    if ([...f.shorthand].some((s) => s !== "b")) notes.push("In Python 3, \\d, \\w and \\s match Unicode digits, letters and spaces (for example Arabic-Indic digits); add re.ASCII to match JavaScript.");
    notes.push("In Python, $ also matches just before a final line break; use \\Z to require the very end.");
  }
  if (flavor === "java") {
    if (f.variableLookbehind && f.lookbehind) notes.push("Java accepts lookbehind only with a bounded maximum length (no * or + inside).");
    if (f.unicodeProperty.some((p) => /Script(_Extensions)?=|scx=|sc=/.test(p))) problems.push("Java writes scripts as \\p{IsGreek}; Script_Extensions is not supported.");
  }
  if (flavor === "pcre") {
    if (f.variableLookbehind) problems.push("PCRE requires each lookbehind alternative to have a fixed length (recent PCRE2 versions allow a bounded length). Rewrite as alternatives of fixed length.");
    if (f.unicodeProperty.length) notes.push("In PHP, add the u modifier so \\p{…} and UTF-8 text work.");
  }
  if (f.shorthand.has("s") && flavor !== "python") notes.push("JavaScript's \\s also matches Unicode spaces such as the no-break space (U+00A0); in this engine it may match ASCII whitespace only.");

  const pattern = applyEdits(source, edits);
  const has = (c: string) => flags.includes(c);
  let code = "";
  if (flavor === "python") {
    const fl = [has("i") && "re.IGNORECASE", has("m") && "re.MULTILINE", has("s") && "re.DOTALL"].filter(Boolean) as string[];
    code = `import re\n\npattern = re.compile(${pyString(pattern)}${fl.length ? `, ${fl.join(" | ")}` : ""})\n${has("g") ? "for m in pattern.finditer(text):\n    print(m.group(0), m.groupdict())" : "m = pattern.search(text)"}\n`;
    if (has("y")) notes.push("The y (sticky) flag has no flag in Python; use pattern.match(text, pos) at the position you want.");
  } else if (flavor === "java") {
    const fl = [has("i") && "Pattern.CASE_INSENSITIVE", has("i") && has("u") && "Pattern.UNICODE_CASE", has("m") && "Pattern.MULTILINE", has("s") && "Pattern.DOTALL"].filter(Boolean) as string[];
    code = `Pattern pattern = Pattern.compile(${javaString(pattern)}${fl.length ? `, ${fl.join(" | ")}` : ""});\nMatcher m = pattern.matcher(text);\n${has("g") ? "while (m.find()) {\n    System.out.println(m.group());\n}" : "if (m.find()) {\n    System.out.println(m.group());\n}"}\n`;
    if (has("y")) notes.push("The y (sticky) flag maps to Matcher.region(…) with lookingAt() in Java.");
  } else if (flavor === "go") {
    const inline = ["i", "m", "s"].filter(has).join("");
    const full = (inline ? `(?${inline})` : "") + pattern;
    const lit = full.includes("`") ? JSON.stringify(full) : `\`${full}\``;
    code = `re := regexp.MustCompile(${lit})\n${has("g") ? "matches := re.FindAllStringSubmatch(text, -1)" : "match := re.FindStringSubmatch(text)"}\n`;
    if (inline) changes.add(`Flags became the inline prefix (?${inline}).`);
    if (has("y")) problems.push("Go has no sticky (y) matching.");
  } else if (flavor === "pcre") {
    const mods = ["i", "m", "s"].filter(has).join("") + (has("u") || f.unicodeProperty.length ? "u" : "");
    const delimited = `/${pattern.replace(/(?<!\\)\//g, "\\/")}/${mods}`;
    code = `${has("g") ? "preg_match_all" : "preg_match"}('${delimited.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}', $text, $matches);\n`;
    if (has("y")) notes.push("The y (sticky) flag corresponds to the \\G anchor or the A modifier in PCRE.");
  } else {
    code = `const re = ${jsLiteral(source, flags)};\n${has("g") ? "for (const m of text.matchAll(re)) console.log(m[0], m.groups);" : "const m = re.exec(text);"}\n`;
  }
  return { flavor, pattern, code, changes: [...changes], problems, notes };
}
