import { ExpressionError, type Step } from "./jsonpath-explain";
import { MAX_EXPRESSION_CHARS } from "./limits";

const q = (s: string) => `“${s}”`;

/** Index after the jq string starting at `i`, including nested "\( … )" interpolations, or -1. */
export function skipJqString(src: string, i: number): number {
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === "\\" && src[j + 1] === "(") {
      let depth = 1;
      j += 2;
      while (j < src.length && depth > 0) {
        if (src[j] === "\"") {
          const end = skipJqString(src, j);
          if (end < 0) return -1;
          j = end;
          continue;
        }
        if (src[j] === "(") depth++;
        else if (src[j] === ")") depth--;
        j++;
      }
      j--;
    } else if (src[j] === "\\") j++;
    else if (src[j] === "\"") return j + 1;
  }
  return -1;
}

function stripComments(src: string): string {
  let out = "";
  for (let i = 0; i < src.length; i++) {
    if (src[i] === "\"") {
      const end = skipJqString(src, i);
      if (end < 0) throw new ExpressionError("A string (\") is never closed.", i);
      out += src.slice(i, end);
      i = end - 1;
    } else if (src[i] === "#") {
      while (i < src.length && src[i] !== "\n") i++;
      out += "\n";
    } else out += src[i];
  }
  return out;
}

/**
 * Splits at a top-level operator, ignoring strings, brackets and
 * if/try/reduce/def … end blocks. `ops` are tried longest first.
 */
function splitAt(s: string, ops: string[], avoid: string[] = []): { parts: string[]; ops: string[] } {
  const parts: string[] = [];
  const found: string[] = [];
  let depth = 0;
  let kw = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "\"") {
      const end = skipJqString(s, i);
      if (end < 0) break;
      i = end - 1;
      continue;
    }
    if ("([{".includes(c)) {
      depth++;
      continue;
    }
    if (")]}".includes(c)) {
      depth--;
      continue;
    }
    const word = /^[A-Za-z_]\w*/.exec(s.slice(i));
    if (word && (i === 0 || !/[\w$.@]/.test(s[i - 1]))) {
      if (word[0] === "if") kw++;
      else if (word[0] === "end") kw--;
      if (depth === 0 && kw === 0 && ops.includes(word[0])) {
        parts.push(s.slice(start, i));
        found.push(word[0]);
        start = i + word[0].length;
      }
      i += word[0].length - 1;
      continue;
    }
    if (depth !== 0 || kw !== 0) continue;
    if (avoid.some((a) => s.startsWith(a, i))) {
      i += avoid.find((a) => s.startsWith(a, i))!.length - 1;
      continue;
    }
    const op = ops.find((o) => !/^[a-z]/.test(o) && s.startsWith(o, i));
    if (op) {
      parts.push(s.slice(start, i));
      found.push(op);
      start = i + op.length;
      i += op.length - 1;
    }
  }
  parts.push(s.slice(start));
  return { parts: parts.map((p) => p.trim()), ops: found };
}

function wrapped(s: string, open: string, close: string): boolean {
  if (!s.startsWith(open) || !s.endsWith(close)) return false;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\"") {
      const end = skipJqString(s, i);
      if (end < 0) return false;
      i = end - 1;
      continue;
    }
    if ("([{".includes(s[i])) depth++;
    else if (")]}".includes(s[i])) depth--;
    if (depth === 0 && i < s.length - 1) return false;
  }
  return depth === 0;
}

/** Splits `name(a; b)` into its name and arguments, or null. */
function call(s: string): { name: string; args: string[] } | null {
  const m = /^(@?[A-Za-z_][\w:]*)\s*\(/.exec(s);
  if (!m || !s.endsWith(")") || !wrapped(s.slice(m[0].length - 1), "(", ")")) return null;
  const inner = s.slice(m[0].length, -1);
  return { name: m[1], args: splitAt(inner, [";"]).parts };
}

/** A path such as `.orders[].customer.name` in words, or null when `s` is not a plain path. */
export function pathWords(s: string): string | null {
  const src = s.trim();
  if (src === ".") return "the input";
  if (src === "..") return "every value at every depth";
  if (!/^(\.|\$)/.test(src)) return null;
  const pieces: string[] = [];
  let i = 0;
  let varName = "";
  if (src[0] === "$") {
    const v = /^\$[A-Za-z_]\w*/.exec(src);
    if (!v) return null;
    varName = v[0];
    i = v[0].length;
  }
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpExecArray | null;
    if ((m = /^\.\.(?![A-Za-z_"[])/.exec(rest))) {
      pieces.push("every value at every depth");
      i += 2;
    } else if ((m = /^\.([A-Za-z_]\w*)/.exec(rest))) {
      pieces.push(q(m[1]));
      i += m[0].length;
    } else if ((m = /^\.?"((?:[^"\\]|\\.)*)"/.exec(rest)) && rest[0] === ".") {
      pieces.push(q(m[1]));
      i += m[0].length;
    } else if ((m = /^\.?\[\s*\]/.exec(rest))) {
      pieces.push("each item");
      i += m[0].length;
    } else if ((m = /^\.?\[\s*(-?\d+)\s*\]/.exec(rest))) {
      pieces.push(Number(m[1]) < 0 ? (m[1] === "-1" ? "the last item" : `item ${m[1]} from the end`) : `item ${m[1]}`);
      i += m[0].length;
    } else if ((m = /^\.?\[\s*(-?\d*)\s*:\s*(-?\d*)\s*\]/.exec(rest))) {
      const [, a, b] = m;
      pieces.push(a === "" ? `the first ${b} items` : b === "" ? (Number(a) < 0 ? `the last ${-Number(a)} items` : `the items from index ${a}`) : `items ${a} to ${Number(b) - 1}`);
      i += m[0].length;
    } else if ((m = /^\.?\[\s*"((?:[^"\\]|\\.)*)"\s*\]/.exec(rest))) {
      pieces.push(q(m[1]));
      i += m[0].length;
    } else if (rest[0] === "?") {
      if (pieces.length) pieces[pieces.length - 1] += " (skipping errors)";
      i++;
    } else if (rest === "." && pieces.length === 0) {
      i++;
    } else return null;
  }
  const head = varName ? `${varName}` : "";
  if (pieces.length === 0) return varName ? `the variable ${varName}` : "the input";
  return (head ? `${head}: ` : "") + pieces.join(" → ");
}

/** A condition such as `.price > 10 and (.tags | length) > 0` in words. */
export function conditionWords(s: string): string {
  const src = s.trim();
  for (const [op, word] of [["or", "or"], ["and", "and"]] as const) {
    const { parts } = splitAt(src, [op]);
    if (parts.length > 1) return parts.map(conditionWords).join(` ${word} `);
  }
  const cmp = splitAt(src, ["==", "!=", "<=", ">=", "<", ">"]);
  if (cmp.parts.length === 2) {
    const words: Record<string, string> = { "==": "equals", "!=": "is not", "<=": "is at most", ">=": "is at least", "<": "is less than", ">": "is greater than" };
    return `${valueWords(cmp.parts[0])} ${words[cmp.ops[0]]} ${valueWords(cmp.parts[1])}`;
  }
  if (/\|\s*not$/.test(src)) return `not (${conditionWords(src.replace(/\|\s*not$/, ""))})`;
  const pipe = splitAt(src, ["|"], ["|="]);
  if (pipe.parts.length === 2) {
    const c = call(pipe.parts[1]);
    const verbs: Record<string, string> = { test: "matches", startswith: "starts with", endswith: "ends with", contains: "contains", inside: "is inside", has: "has the key", index: "contains" };
    if (c && verbs[c.name]) return `${valueWords(pipe.parts[0])} ${verbs[c.name]} ${c.args.map(valueWords).join(", ")}`;
    if (pipe.parts[1] === "length") return `the length of ${valueWords(pipe.parts[0])}`;
  }
  const c = call(src);
  if (c) {
    if (c.name === "has") return `the input has the key ${valueWords(c.args[0])}`;
    if (c.name === "test") return `the input matches ${valueWords(c.args[0])}`;
    if (c.name === "startswith" || c.name === "endswith" || c.name === "contains") return `the input ${c.name.replace("with", "s with").replace("contains", "contains")} ${valueWords(c.args[0])}`;
    if (c.name === "any" || c.name === "all") return `${c.name} of ${c.args.map(valueWords).join(", ")} is true`;
  }
  const p = pathWords(src);
  if (p) return `${p === "the input" ? "the input" : p} is not null or false`;
  return valueWords(src);
}

function valueWords(s: string): string {
  const src = s.trim();
  if (wrapped(src, "(", ")")) return valueWords(src.slice(1, -1));
  const p = pathWords(src);
  if (p) return p === "the input" ? "the input" : p;
  if (/^"/.test(src) || /^-?\d/.test(src) || /^(true|false|null)$/.test(src)) return src;
  const pipe = splitAt(src, ["|"], ["|="]);
  if (pipe.parts.length === 2 && pipe.parts[1] === "length") return `the length of ${valueWords(pipe.parts[0])}`;
  if (src === "length") return "the length";
  return `\`${src}\``;
}

const SIMPLE: Record<string, string> = {
  length: "Count: the number of items in an array, keys in an object, or characters in a string.",
  keys: "List the keys of the object (sorted), or the indexes of the array.",
  keys_unsorted: "List the keys of the object in their original order.",
  values: "Drop null values.",
  add: "Add up the items of the array: numbers are summed, strings joined, arrays concatenated, objects merged.",
  any: "True if any item of the array is true.",
  all: "True if every item of the array is true.",
  flatten: "Flatten nested arrays into one array.",
  sort: "Sort the array (null, false, true, numbers, strings, arrays, objects).",
  unique: "Sort the array and remove duplicates.",
  reverse: "Reverse the array (or string).",
  min: "Take the smallest item of the array.",
  max: "Take the largest item of the array.",
  first: "Take the first item of the array.",
  last: "Take the last item of the array.",
  to_entries: "Turn the object into an array of {key, value} pairs.",
  from_entries: "Turn an array of {key, value} pairs back into an object.",
  tostring: "Convert the value to a string (objects and arrays become JSON text).",
  tonumber: "Convert a string such as \"42\" to a number.",
  type: "Give the type name: \"object\", \"array\", \"string\", \"number\", \"boolean\" or \"null\".",
  not: "Negate: true becomes false, and null or false become true.",
  empty: "Produce no output at all.",
  ascii_downcase: "Convert the string to lower case.",
  ascii_upcase: "Convert the string to upper case.",
  floor: "Round the number down.",
  ceil: "Round the number up.",
  round: "Round the number to the nearest integer.",
  abs: "Take the absolute value.",
  sqrt: "Take the square root.",
  tojson: "Encode the value as a JSON string.",
  fromjson: "Parse a string that contains JSON.",
  paths: "List the path of every value in the input, as arrays of keys and indexes.",
  leaf_paths: "List the paths to every value that is not an object or array.",
  todate: "Format a Unix timestamp as an ISO 8601 date.",
  fromdate: "Parse an ISO 8601 date into a Unix timestamp.",
  now: "The current time as a Unix timestamp.",
  transpose: "Transpose an array of arrays (rows become columns).",
  input: "Read the next input (there is only one input here).",
  "@csv": "Format an array as one CSV line (use with -r / raw output).",
  "@tsv": "Format an array as one tab-separated line (use with -r / raw output).",
  "@json": "Encode the value as JSON text.",
  "@text": "Convert the value to text.",
  "@html": "Escape the string for HTML.",
  "@uri": "Percent-encode the string for a URL.",
  "@base64": "Encode the string as Base64.",
  "@base64d": "Decode a Base64 string.",
  "@sh": "Quote the value for a POSIX shell.",
  tostream: "Turn the value into a stream of [path, leaf] events.",
  env: "The environment variables (empty in the browser).",
  halt: "Stop the program without an error.",
  splits: "Split a string with a regex, one output per piece.",
  ltrimstr: "Remove a prefix from the string.",
  rtrimstr: "Remove a suffix from the string.",
  "..": "Take every value at every depth (the input itself, then everything inside it).",
};

type Explainer = (args: string[], depth: number, steps: Step[], code: string) => string;

const CALLS: Record<string, Explainer> = {
  select: (a) => `Keep only the inputs where ${conditionWords(a[0])}; drop the others.`,
  map: (a, d, steps, code) => nested("For each item of the array, run the steps below and collect the results into a new array:", a[0], d, steps, code),
  map_values: (a, d, steps, code) => nested("Replace each value of the object or array with the result of:", a[0], d, steps, code),
  with_entries: (a, d, steps, code) => nested("Turn the object into {key, value} pairs, change each pair with the steps below, and turn it back into an object:", a[0], d, steps, code),
  sort_by: (a) => `Sort the array by ${a.map(valueWords).join(", then ")}, smallest first.`,
  group_by: (a) => `Group the items into arrays that share the same ${valueWords(a[0])} (groups sorted by it).`,
  unique_by: (a) => `Keep one item for each distinct ${valueWords(a[0])}.`,
  min_by: (a) => `Take the item with the smallest ${valueWords(a[0])}.`,
  max_by: (a) => `Take the item with the largest ${valueWords(a[0])}.`,
  has: (a) => `True if the input has the key ${valueWords(a[0])}.`,
  in: (a) => `True if the input is a key of ${valueWords(a[0])}.`,
  del: (a) => `Delete ${valueWords(a[0])} and return what is left.`,
  test: (a) => `True if the string matches the regular expression ${a.map(valueWords).join(" with flags ")}.`,
  match: (a) => `Find matches of the regular expression ${valueWords(a[0])}, with their offsets and groups.`,
  capture: (a) => `Match the regular expression ${valueWords(a[0])} and return its named groups as an object.`,
  sub: (a) => `Replace the first match of ${valueWords(a[0])} with ${valueWords(a[1] ?? "")}.`,
  gsub: (a) => `Replace every match of ${valueWords(a[0])} with ${valueWords(a[1] ?? "")}.`,
  split: (a) => `Split the string at ${valueWords(a[0])} into an array.`,
  join: (a) => `Join the array's items into one string, separated by ${valueWords(a[0])}.`,
  startswith: (a) => `True if the string starts with ${valueWords(a[0])}.`,
  endswith: (a) => `True if the string ends with ${valueWords(a[0])}.`,
  ltrimstr: (a) => `Remove ${valueWords(a[0])} from the start of the string, if present.`,
  rtrimstr: (a) => `Remove ${valueWords(a[0])} from the end of the string, if present.`,
  contains: (a) => `True if the input contains ${valueWords(a[0])} (substrings, sub-arrays and sub-objects count).`,
  inside: (a) => `True if the input is contained in ${valueWords(a[0])}.`,
  index: (a) => `The position of the first ${valueWords(a[0])}.`,
  indices: (a) => `Every position of ${valueWords(a[0])}.`,
  first: (a) => `Take only the first output of ${valueWords(a[0])}.`,
  last: (a) => `Take only the last output of ${valueWords(a[0])}.`,
  limit: (a) => `Take at most ${valueWords(a[0])} outputs of ${valueWords(a[1] ?? "")}.`,
  nth: (a) => `Take output number ${valueWords(a[0])} (from 0)${a[1] ? ` of ${valueWords(a[1])}` : ""}.`,
  range: (a) => (a.length === 1 ? `Produce the numbers 0 up to ${valueWords(a[0])} (not included).` : `Produce the numbers from ${valueWords(a[0])} up to ${valueWords(a[1])} (not included)${a[2] ? `, in steps of ${valueWords(a[2])}` : ""}.`),
  any: (a) => (a.length === 1 ? `True if ${conditionWords(a[0])} for any item.` : `True if ${valueWords(a[1])} is true for any output of ${valueWords(a[0])}.`),
  all: (a) => (a.length === 1 ? `True if ${conditionWords(a[0])} for every item.` : `True if ${valueWords(a[1])} is true for every output of ${valueWords(a[0])}.`),
  path: (a) => `The path to ${valueWords(a[0])}, as an array of keys and indexes.`,
  paths: (a) => `The paths of all values for which ${conditionWords(a[0])}.`,
  getpath: (a) => `The value at the path ${valueWords(a[0])}.`,
  setpath: (a) => `Set the value at the path ${valueWords(a[0])} to ${valueWords(a[1] ?? "")}.`,
  recurse: (a) => `Apply ${valueWords(a[0])} again and again, outputting every value on the way.`,
  walk: (a, d, steps, code) => nested("Go through every value, deepest first, and replace it with the result of:", a[0], d, steps, code),
  until: (a) => `Repeat ${valueWords(a[1] ?? "")} until ${conditionWords(a[0])}.`,
  error: (a) => `Stop with the error message ${valueWords(a[0])}.`,
  tostream: () => SIMPLE.tostream,
  splits: (a) => `Split the string at matches of ${valueWords(a[0])}, one output per piece.`,
  ascii: () => "Convert a code point to a one-character string.",
  isempty: (a) => `True if ${valueWords(a[0])} produces no output.`,
  pick: (a) => `Keep only ${valueWords(a[0])}, in the same nested shape.`,
  strftime: (a) => `Format a timestamp with the pattern ${valueWords(a[0])}.`,
  strptime: (a) => `Parse a date string with the pattern ${valueWords(a[0])}.`,
  tojson: () => SIMPLE.tojson,
};

function nested(text: string, inner: string, depth: number, steps: Step[], code: string): string {
  steps.push({ code, text, depth });
  explainPipe(inner, depth + 1, steps);
  return "";
}

function objectWords(inner: string): string {
  const entries = splitAt(inner, [","]).parts.filter((p) => p !== "");
  const keys = entries.map((e) => {
    const kv = splitAt(e, [":"]);
    if (kv.parts.length === 1) {
      const k = e.replace(/^\$/, "").replace(/^"|"$/g, "");
      return `${q(k)} (copied from ${e.startsWith("$") ? `the variable ${e}` : `the input's ${q(k)}`})`;
    }
    const key = kv.parts[0].replace(/^"(.*)"$/, "$1");
    const value = kv.parts.slice(1).join(":");
    const from = pathWords(value);
    return `${wrapped(key, "(", ")") ? `a key computed by \`${key}\`` : q(key)}${from ? ` (from ${from})` : ` = \`${value}\``}`;
  });
  return keys.length === 0 ? "Build an empty object." : `Build a new object with ${keys.length === 1 ? "the key" : "the keys"} ${keys.join(", ")}.`;
}

function explainStage(stage: string, depth: number, steps: Step[]): void {
  const s = stage.trim();
  if (s === "") return;
  const push = (text: string) => {
    if (text) steps.push({ code: s, text, depth });
  };

  const comma = splitAt(s, [","]);
  if (comma.parts.length > 1) {
    steps.push({ code: s, text: `Produce ${comma.parts.length} outputs, one after the other:`, depth });
    for (const p of comma.parts) explainPipe(p, depth + 1, steps);
    return;
  }
  const alt = splitAt(s, ["//"], ["//="]);
  if (alt.parts.length > 1) {
    push(`Use ${alt.parts.slice(0, -1).map(valueWords).join(", or else ")}; if that is null, false or missing, use ${valueWords(alt.parts[alt.parts.length - 1])} instead.`);
    return;
  }
  const assign = splitAt(s, ["|=", "+=", "-=", "*=", "/=", "%=", "//=", "="], ["==", "!=", "<=", ">="]);
  if (assign.parts.length === 2) {
    const op = assign.ops[0];
    const target = valueWords(assign.parts[0]);
    const words: Record<string, string> = { "|=": `Update ${target} by running \`${assign.parts[1]}\` on its current value`, "=": `Set ${target} to ${valueWords(assign.parts[1])}`, "+=": `Add ${valueWords(assign.parts[1])} to ${target}`, "-=": `Subtract ${valueWords(assign.parts[1])} from ${target}`, "*=": `Multiply ${target} by ${valueWords(assign.parts[1])}`, "/=": `Divide ${target} by ${valueWords(assign.parts[1])}`, "%=": `Set ${target} to itself modulo ${valueWords(assign.parts[1])}`, "//=": `Give ${target} the value ${valueWords(assign.parts[1])} if it is null or false` };
    push(`${words[op]}, and return the whole changed input.`);
    return;
  }
  if (splitAt(s, ["and", "or"]).parts.length > 1 || splitAt(s, ["==", "!=", "<=", ">=", "<", ">"]).parts.length === 2) {
    push(`True or false: is it the case that ${conditionWords(s)}?`);
    return;
  }
  const arith = splitAt(s, ["+", "-", "*", "/", "%"]);
  if (arith.parts.length > 1 && arith.parts.every((p) => p !== "")) {
    const words: Record<string, string> = { "+": "plus", "-": "minus", "*": "times", "/": "divided by", "%": "modulo" };
    push(`Compute ${arith.parts.map((p, i) => (i === 0 ? valueWords(p) : `${words[arith.ops[i - 1]]} ${valueWords(p)}`)).join(" ")}.`);
    return;
  }

  if (wrapped(s, "(", ")")) {
    explainPipe(s.slice(1, -1), depth, steps);
    return;
  }
  if (wrapped(s, "[", "]")) {
    const inner = s.slice(1, -1).trim();
    if (inner === "") return push("An empty array.");
    steps.push({ code: s, text: "Collect every output of the steps below into one array:", depth });
    explainPipe(inner, depth + 1, steps);
    return;
  }
  if (wrapped(s, "{", "}")) return push(objectWords(s.slice(1, -1)));
  if (s.endsWith("?") && !s.endsWith("[]?") && !/\]\?$/.test(s) && pathWords(s) === null) {
    steps.push({ code: s, text: "Run the following, and ignore any error it raises:", depth });
    explainStage(s.slice(0, -1), depth + 1, steps);
    return;
  }
  const ifm = /^if\b([\s\S]*)\bend$/.exec(s);
  if (ifm) {
    const thenSplit = splitAt(ifm[1], ["then"]);
    const cond = thenSplit.parts[0];
    const rest = thenSplit.parts.slice(1).join(" then ");
    const elseSplit = splitAt(rest, ["elif", "else"]);
    push(`If ${conditionWords(cond)}, then ${valueWords(elseSplit.parts[0])}${elseSplit.parts.length > 1 ? `; otherwise ${valueWords(elseSplit.parts.slice(1).join(" else "))}` : "; otherwise keep the input as it is"}.`);
    return;
  }
  const red = /^(reduce|foreach)\s+([\s\S]+?)\s+as\s+(\$\w+|\[[^\]]*\]|\{[^}]*\})\s*\(([\s\S]*)\)$/.exec(s);
  if (red) {
    const args = splitAt(red[4], [";"]).parts;
    push(red[1] === "reduce"
      ? `Combine all outputs of ${valueWords(red[2])} into one value: start with ${valueWords(args[0])}, then for each one (called ${red[3]}) update the running value with ${valueWords(args[1] ?? ".")}.`
      : `Go through the outputs of ${valueWords(red[2])} (each called ${red[3]}), starting from ${valueWords(args[0])} and updating with ${valueWords(args[1] ?? ".")}, outputting each intermediate value.`);
    return;
  }
  const trym = /^try\s+([\s\S]+?)(?:\s+catch\s+([\s\S]+))?$/.exec(s);
  if (trym) {
    const handler = trym[2]?.trim();
    push(`Run ${valueWords(trym[1])}${handler === "." ? "; if it fails, output the error message instead" : handler ? `; if it fails, run ${valueWords(handler)} on the error message` : " and ignore any error"}.`);
    return;
  }
  const p = pathWords(s);
  if (p !== null) {
    if (s === ".") return push("Take the input as it is.");
    if (s.startsWith("$")) return push(`Use ${p}.`);
    const many = /\[\s*\]/.test(s) || s.startsWith("..");
    return push(`Take ${p}${many ? " (one output for each)" : ""}.`);
  }
  if (/^"/.test(s)) return push(s.includes("\\(") ? `Build the string ${s}, filling in each \\( … \\) from the input.` : `The constant string ${s}.`);
  if (/^-?\d/.test(s)) return push(`The constant number ${s}.`);
  if (/^(true|false|null)$/.test(s)) return push(`The constant ${s}.`);
  if (SIMPLE[s]) return push(SIMPLE[s]);
  const fmt = /^(@\w+)\s+("[\s\S]*")$/.exec(s);
  if (fmt) return push(`Build the string ${fmt[2]}, with every \\( … \\) value formatted by ${fmt[1]}.`);
  const c = call(s);
  if (c) {
    const ex = CALLS[c.name];
    if (ex) return push(ex(c.args, depth, steps, s));
    return push(`Call ${c.name} with ${c.args.map(valueWords).join(" and ")}.`);
  }
  if (/^[A-Za-z_]\w*$/.test(s)) return push(`Call ${s} (a jq built-in or a function defined above).`);
  if (/^\$__loc__$/.test(s)) return push("The current file and line number.");
  push(`Evaluate \`${s}\`.`);
}

function explainPipe(src: string, depth: number, steps: Step[]): void {
  let s = src.trim();
  // def name(args): body; rest
  for (;;) {
    const def = /^def\s+([A-Za-z_][\w:]*)\s*(\([^)]*\))?\s*:/.exec(s);
    if (!def) break;
    const body = splitAt(s.slice(def[0].length), [";"]);
    steps.push({ code: `def ${def[1]}${def[2] ?? ""}: ${body.parts[0]};`, text: `Define a function ${def[1]}${def[2] ? ` taking ${def[2].slice(1, -1).split(";").map((x) => x.trim()).join(" and ")}` : ""}; it runs \`${body.parts[0]}\` when called.`, depth });
    s = body.parts.slice(1).join(";").trim();
  }
  const { parts } = splitAt(s, ["|"], ["|="]);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const asm = /^([\s\S]+?)\s+as\s+(\$\w+|\[[\s\S]*\]|\{[\s\S]*\})\s*$/.exec(part);
    if (asm && !/^(reduce|foreach)\b/.test(part)) {
      steps.push({ code: `${part} |`, text: `Save ${valueWords(asm[1])} as ${asm[2]} (once for each output), then carry on with the same input.`, depth });
      continue;
    }
    explainStage(part, depth, steps);
  }
}

/** Explains a jq program step by step. jq itself reports syntax errors, so this never rejects odd but valid programs. */
export function explainJq(expr: string): Step[] {
  if (expr.length > MAX_EXPRESSION_CHARS) throw new ExpressionError(`The expression is ${expr.length.toLocaleString("en-US")} characters long; the limit is ${MAX_EXPRESSION_CHARS.toLocaleString("en-US")}.`, 0);
  const src = stripComments(expr).trim();
  if (src === "") throw new ExpressionError("Type a jq filter, for example .orders[] | .id", 0);
  const steps: Step[] = [];
  explainPipe(src, 0, steps);
  if (steps.length === 0) steps.push({ code: src, text: `Evaluate \`${src}\`.`, depth: 0 });
  return steps;
}
