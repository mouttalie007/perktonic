import { RegExpParser, type AST } from "@eslint-community/regexpp";

export interface Step {
  raw: string;
  text: string;
  depth: number;
}

export interface Analysis {
  steps: Step[];
  /** Capturing groups in order: number and optional name. */
  groups: { index: number; name: string | null }[];
  /** Features used, for the flavour warnings. */
  features: Features;
  /** Patterns that can backtrack catastrophically, such as (a+)+. */
  risks: string[];
}

export interface Features {
  namedGroups: string[];
  namedBackrefs: boolean;
  backrefs: boolean;
  lookahead: boolean;
  lookbehind: boolean;
  variableLookbehind: boolean;
  unicodeProperty: string[];
  unicodeCodePointEscape: boolean;
  anyCharClass: boolean;
  shorthand: Set<"d" | "w" | "s" | "b">;
  classSetOps: boolean;
  lazy: boolean;
}

export class PatternError extends Error {
  constructor(
    message: string,
    readonly index: number,
  ) {
    super(message);
  }
}

const SETS: Record<string, string> = {
  digit: "a digit (0–9)",
  space: "a whitespace character (space, tab, line break…)",
  word: "a word character (letter, digit or _)",
};

function describeChar(c: AST.Character): string {
  const v = c.value;
  if (c.raw === "\\n") return "a line feed (\\n)";
  if (c.raw === "\\r") return "a carriage return (\\r)";
  if (c.raw === "\\t") return "a tab (\\t)";
  if (v === 32) return "a space";
  if (c.raw.startsWith("\\u") || c.raw.startsWith("\\x")) return `the character U+${v.toString(16).toUpperCase().padStart(4, "0")} (“${String.fromCodePoint(v)}”)`;
  return `“${String.fromCodePoint(v)}”`;
}

function describeSet(s: AST.CharacterSet): string {
  if (s.kind === "any") return "any character except a line break (or any character with the s flag)";
  if (s.kind === "property") {
    const name = s.value ? `${s.key}=${s.value}` : s.key;
    return `${s.negate ? "any character that is not" : "a character with"} the Unicode property ${name}`;
  }
  const base = SETS[s.kind];
  return s.negate ? `anything except ${base}` : base;
}

function classItem(e: AST.CharacterClassElement): string {
  switch (e.type) {
    case "Character":
      return describeChar(e);
    case "CharacterClassRange":
      return `${describeChar(e.min)} to ${describeChar(e.max)}`;
    case "CharacterSet":
      return describeSet(e);
    default:
      return `\`${e.raw}\``;
  }
}

function quantifierWords(q: AST.Quantifier): string {
  const { min, max, greedy } = q;
  let w: string;
  if (min === 0 && max === Infinity) w = "zero or more times";
  else if (min === 1 && max === Infinity) w = "one or more times";
  else if (min === 0 && max === 1) w = "optionally (zero or one time)";
  else if (min === max) w = `exactly ${min} time${min === 1 ? "" : "s"}`;
  else if (max === Infinity) w = `at least ${min} times`;
  else w = `between ${min} and ${max} times`;
  return greedy ? `${w}, as many as possible` : `${w}, as few as possible (lazy)`;
}

/** Whether a node can match strings of different lengths (for the lookbehind warning). */
function variableWidth(n: AST.Node): boolean {
  switch (n.type) {
    case "Quantifier":
      return n.min !== n.max || variableWidth(n.element);
    case "Alternative":
      return n.elements.some(variableWidth);
    case "Group":
    case "CapturingGroup":
    case "Assertion":
      if ("alternatives" in n) {
        const lens = n.alternatives.map(fixedLength);
        return lens.some((l) => l === null) || new Set(lens).size > 1;
      }
      return false;
    case "Backreference":
      return true;
    default:
      return false;
  }
}

function fixedLength(n: AST.Node): number | null {
  switch (n.type) {
    case "Character":
    case "CharacterSet":
    case "CharacterClass":
      return 1;
    case "Assertion":
      return 0;
    case "Quantifier": {
      const l = fixedLength(n.element);
      return l !== null && n.min === n.max ? l * n.min : null;
    }
    case "Alternative": {
      let t = 0;
      for (const e of n.elements) {
        const l = fixedLength(e);
        if (l === null) return null;
        t += l;
      }
      return t;
    }
    case "Group":
    case "CapturingGroup": {
      const ls = n.alternatives.map(fixedLength);
      return ls.every((l) => l !== null && l === ls[0]) ? ls[0] : null;
    }
    default:
      return null;
  }
}

function hasUnboundedQuantifier(n: AST.Node): boolean {
  if (n.type === "Quantifier") return n.max === Infinity || hasUnboundedQuantifier(n.element);
  if ("alternatives" in n) return n.alternatives.some(hasUnboundedQuantifier);
  if (n.type === "Alternative") return n.elements.some(hasUnboundedQuantifier);
  return false;
}

export function parseAst(source: string, flags: string): AST.Pattern {
  return new RegExpParser({ ecmaVersion: 2025 }).parsePattern(source, 0, source.length, { unicode: flags.includes("u"), unicodeSets: flags.includes("v") });
}

/**
 * Parses a JavaScript pattern with regexpp and explains it node by node.
 * Runs of plain characters are merged ("the text “abc”") so the steps stay readable.
 */
export function analyze(source: string, flags: string): Analysis {
  const parser = new RegExpParser({ ecmaVersion: 2025 });
  let ast: AST.Pattern;
  try {
    ast = parser.parsePattern(source, 0, source.length, { unicode: flags.includes("u"), unicodeSets: flags.includes("v") });
  } catch (e) {
    const err = e as Error & { index?: number };
    const msg = err.message.replace(/^Invalid regular expression: \/[\s\S]*\/[a-z]*: /, "");
    throw new PatternError(friendly(msg), err.index ?? 0);
  }
  const steps: Step[] = [];
  const groups: Analysis["groups"] = [];
  const risks: string[] = [];
  const features: Features = { namedGroups: [], namedBackrefs: false, backrefs: false, lookahead: false, lookbehind: false, variableLookbehind: false, unicodeProperty: [], unicodeCodePointEscape: false, anyCharClass: false, shorthand: new Set(), classSetOps: false, lazy: false };
  let groupNo = 0;

  const elements = (els: AST.Element[], depth: number) => {
    let run = "";
    let runRaw = "";
    const flush = () => {
      if (!run) return;
      steps.push({ raw: runRaw, text: run === " " ? "a space" : [...run].length === 1 ? `the character “${run}”` : `the text “${run}”`, depth });
      run = "";
      runRaw = "";
    };
    for (const e of els) {
      if (e.type === "Character" && /^[^\\]$|^\\[.*+?^$|()[\]{}/\\-]$/.test(e.raw)) {
        run += String.fromCodePoint(e.value);
        runRaw += e.raw;
        continue;
      }
      flush();
      node(e, depth);
    }
    flush();
  };

  const alternatives = (alts: AST.Alternative[], depth: number) => {
    if (alts.length === 1) return elements(alts[0].elements, depth);
    alts.forEach((a, i) => {
      steps.push({ raw: a.raw || "(empty)", text: i === 0 ? `Either this alternative (${i + 1} of ${alts.length}):` : `Or alternative ${i + 1} of ${alts.length}:`, depth });
      elements(a.elements, depth + 1);
    });
  };

  const node = (n: AST.Node, depth: number): void => {
    switch (n.type) {
      case "Character":
        steps.push({ raw: n.raw, text: describeChar(n), depth });
        if (n.raw.startsWith("\\u{")) features.unicodeCodePointEscape = true;
        return;
      case "CharacterSet":
        steps.push({ raw: n.raw, text: describeSet(n), depth });
        if (n.kind === "property") features.unicodeProperty.push(n.raw);
        if (n.kind === "digit") features.shorthand.add("d");
        if (n.kind === "word") features.shorthand.add("w");
        if (n.kind === "space") features.shorthand.add("s");
        return;
      case "CharacterClass": {
        if (n.raw === "[^]") {
          features.anyCharClass = true;
          steps.push({ raw: n.raw, text: "any character at all, line breaks included", depth });
          return;
        }
        if (n.unicodeSets && /--|&&/.test(n.raw)) features.classSetOps = true;
        for (const el of n.elements) {
          if (el.type === "CharacterSet" && el.kind === "property") features.unicodeProperty.push(el.raw);
          if (el.type === "CharacterSet" && el.kind === "digit") features.shorthand.add("d");
          if (el.type === "CharacterSet" && el.kind === "word") features.shorthand.add("w");
        }
        const items = n.elements.map((x) => classItem(x as AST.CharacterClassElement));
        steps.push({ raw: n.raw, text: `${n.negate ? "one character that is NOT" : "one character from"}: ${items.join(", ")}`, depth });
        return;
      }
      case "ExpressionCharacterClass":
        features.classSetOps = true;
        steps.push({ raw: n.raw, text: "a character from a set expression (intersection or subtraction, v flag)", depth });
        return;
      case "Quantifier": {
        if (!n.greedy) features.lazy = true;
        const inner = n.element;
        if (n.max === Infinity && (inner.type === "Group" || inner.type === "CapturingGroup") && hasUnboundedQuantifier(inner)) {
          risks.push(`${n.raw}: a repeated group that itself contains a repetition. On text that almost matches, the engine can try exponentially many ways (catastrophic backtracking). Make the inner part unambiguous, e.g. (a+)+ → a+.`);
        }
        steps.push({ raw: n.raw, text: `Repeat ${quantifierWords(n)}:`, depth });
        node(inner, depth + 1);
        return;
      }
      case "Group":
        steps.push({ raw: n.raw, text: "A group (not captured):", depth });
        alternatives(n.alternatives, depth + 1);
        return;
      case "CapturingGroup": {
        groupNo++;
        groups.push({ index: groupNo, name: n.name });
        if (n.name) features.namedGroups.push(n.name);
        steps.push({ raw: n.raw, text: n.name ? `Capture group ${groupNo}, named “${n.name}”:` : `Capture group ${groupNo}:`, depth });
        alternatives(n.alternatives, depth + 1);
        return;
      }
      case "Assertion":
        switch (n.kind) {
          case "start":
            steps.push({ raw: n.raw, text: "the start of the text (or of a line with the m flag)", depth });
            return;
          case "end":
            steps.push({ raw: n.raw, text: "the end of the text (or of a line with the m flag)", depth });
            return;
          case "word":
            steps.push({ raw: n.raw, text: n.negate ? "a position that is NOT a word boundary" : "a word boundary", depth });
            features.shorthand.add("b");
            return;
          case "lookahead":
            features.lookahead = true;
            steps.push({ raw: n.raw, text: n.negate ? "Only if NOT followed by (lookahead, not consumed):" : "Only if followed by (lookahead, not consumed):", depth });
            alternatives(n.alternatives, depth + 1);
            return;
          case "lookbehind":
            features.lookbehind = true;
            if (n.alternatives.some(variableWidth) || new Set(n.alternatives.map(fixedLength)).size > 1 || n.alternatives.some((a) => fixedLength(a) === null)) features.variableLookbehind = true;
            steps.push({ raw: n.raw, text: n.negate ? "Only if NOT preceded by (lookbehind):" : "Only if preceded by (lookbehind):", depth });
            alternatives(n.alternatives, depth + 1);
            return;
        }
        return;
      case "Backreference":
        features.backrefs = true;
        if (typeof n.ref === "string") features.namedBackrefs = true;
        steps.push({ raw: n.raw, text: typeof n.ref === "string" ? `the same text that group “${n.ref}” matched` : `the same text that group ${n.ref} matched`, depth });
        return;
      default:
        steps.push({ raw: n.raw, text: `\`${n.raw}\``, depth });
    }
  };

  if (source === "") steps.push({ raw: "", text: "An empty pattern matches the empty string at every position.", depth: 0 });
  else alternatives(ast.alternatives, 0);
  return { steps, groups, features, risks };
}

function friendly(msg: string): string {
  if (/Unterminated group/.test(msg)) return "A “(” is never closed. Add “)” or escape it as \\(.";
  if (/Unmatched '\)'/.test(msg)) return "A “)” has no matching “(”. Remove it or escape it as \\).";
  if (/Unterminated character class/.test(msg)) return "A “[” is never closed. Add “]” or escape it as \\[.";
  if (/Nothing to repeat/.test(msg)) return "A quantifier (*, +, ? or {n}) has nothing before it to repeat. Escape it (\\*, \\+, \\?) if you mean the character.";
  if (/numbers out of order/.test(msg)) return "A quantifier {min,max} has min greater than max.";
  if (/Range out of order/.test(msg)) return "A character range is backwards, e.g. [z-a]. Write the lower character first: [a-z].";
  if (/Invalid named capture referenced/.test(msg)) return "A \\k<name> refers to a group name that does not exist.";
  if (/Duplicate capture group name/.test(msg)) return "Two groups have the same name. Group names must be unique.";
  if (/Invalid escape/.test(msg) || /Invalid property name/.test(msg)) return `${msg}. With the u flag, only defined escapes are allowed.`;
  return msg;
}
