import { pointerAt } from "./input";

export interface FriendlyError {
  message: string;
  hint: string | null;
  /** Position in the expression, for compile errors. */
  line: number | null;
  column: number | null;
  pointer: string | null;
}

const ARITY_HINTS: Record<string, number[]> = {
  map: [1], select: [1], sort_by: [1], group_by: [1], unique_by: [1], min_by: [1], max_by: [1], has: [1], test: [1, 2], split: [1, 2],
  join: [1], limit: [2], range: [1, 2, 3], sub: [2, 3], gsub: [2, 3], first: [0, 1], last: [0, 1], with_entries: [1], del: [1], startswith: [1], endswith: [1], contains: [1],
};

function runtimeHint(msg: string): string | null {
  let m: RegExpExecArray | null;
  if ((m = /^Cannot index array with (?:string )?"?\(?"([^"]*)"\)?/.exec(msg)) || (m = /^Cannot index array with string \("([^"]*)"\)/.exec(msg))) {
    return `The value here is an array, and arrays have no key “${m[1]}”. Add [] to go through the items first, for example .[] | .${m[1]} or map(.${m[1]}).`;
  }
  if (/^Cannot index object with number/.test(msg)) return "Objects are read by key, not by position: use .name or .[\"name\"]. To number the entries, use to_entries.";
  if ((m = /^Cannot index (string|number|boolean|null) with (?:string )?\(?"([^"]*)"/.exec(msg))) return `The value here is ${m[1] === "null" ? "null" : `a ${m[1]}`}, not an object, so it has no key “${m[2]}”. Check the path one step earlier, or add ? (.${m[2]}?) to skip such values.`;
  if (/^Cannot iterate over null/.test(msg)) return "[] was used on null, usually because a key is missing or misspelled. Check the path, or write .items[]? to skip missing values.";
  if ((m = /^Cannot iterate over (string|number|boolean)/.exec(msg))) return `[] only works on arrays and objects, but the value here is a ${m[1]}. Remove the [] or check the path.`;
  if (/cannot be matched, as it is not a string/.test(msg)) return "test, match and capture need a string. Convert with tostring, or keep only strings with select(type == \"string\").";
  if (/cannot be added/.test(msg)) return "+ needs two values of the same kind (two numbers, two strings, two arrays or two objects). Convert one side with tostring or tonumber first.";
  if (/cannot be (subtracted|multiplied|divided)/.test(msg)) return "Arithmetic needs numbers here. Check that both sides are numbers, or convert with tonumber.";
  if (/has no keys/.test(msg)) return "keys works on objects and arrays only.";
  if (/cannot be parsed as a number/.test(msg)) return "tonumber only accepts text that is a number, such as \"42\" or \"3.5\".";
  if (/is not valid in a csv row|cannot be csv-formatted/.test(msg)) return "@csv and @tsv need an array of strings, numbers, booleans or null, such as [.id, .name] | @csv.";
  if (/Cannot use .* as object key/.test(msg)) return "Object keys must be strings. Wrap a computed key in parentheses and convert it: {(.id | tostring): .name}.";
  return null;
}

/** Turns jq's stderr into a message and a hint written for people. */
export function friendlyJqError(stderr: string, expression: string): FriendlyError {
  const text = stderr.trim();
  const first = text.split("\n")[0] ?? "";
  const compile = /^jq: error: (.*?)(?: at <top-level>, line (\d+)(?:, column (\d+))?:?)?$/.exec(first);
  if (compile && /compile error/.test(text)) {
    let message = compile[1];
    const line = compile[2] ? Number(compile[2]) : null;
    const column = compile[3] ? Number(compile[3]) : null;
    let hint: string | null = null;
    let m: RegExpExecArray | null;
    if (/INVALID_CHARACTER/.test(message) && expression.includes("'")) hint = "jq strings use double quotes: \"shipped\", not 'shipped'.";
    else if (/unexpected (end of file|\$end)/.test(message)) hint = "The filter ends too early. Check that every (, [, {, \" and if … end is closed.";
    else if ((m = /^\$(\w+) is not defined/.exec(message))) hint = `Define the variable first, for example: .orders[] as $${m[1]} | …`;
    else if ((m = /^([A-Za-z_@][\w:]*)\/(\d+) is not defined/.exec(message))) {
      const arities = ARITY_HINTS[m[1]];
      if (arities && !arities.includes(Number(m[2]))) hint = `${m[1]} takes ${arities.join(" or ")} argument${arities.length === 1 && arities[0] === 1 ? "" : "s"}. In jq, arguments are separated with ; not with ,.`;
      else hint = `jq has no function called ${m[1]}. Check the spelling (built-ins are lower case, such as ascii_downcase).`;
    } else if (/syntax error/.test(message)) hint = "Check the character marked below. Common causes: a missing |, a comma where jq expects ;, or single quotes.";
    message = message.replace(/^syntax error, /, "Syntax error: ").replace(/unexpected INVALID_CHARACTER/, "unexpected character").replace(/\$end/, "end of the filter");
    return { message: `${message}.`, hint, line, column, pointer: line && column ? pointerAt(expression, line, column) : null };
  }
  const runtime = /^jq: error \(at [^)]*\): ([\s\S]*)$/.exec(first);
  if (runtime) {
    const message = runtime[1].trim();
    return { message: `Runtime error: ${message}`, hint: runtimeHint(message), line: null, column: null, pointer: null };
  }
  const parse = /^jq: (?:error \(at [^)]*\): )?parse error: (.*)$/.exec(first);
  if (parse) return { message: `jq could not read the JSON: ${parse[1]}`, hint: null, line: null, column: null, pointer: null };
  return { message: text.replace(/^jq: (error: )?/, "") || "jq stopped without a message.", hint: null, line: null, column: null, pointer: null };
}

/**
 * Counts the outputs in jq's pretty-printed stdout: each one starts at
 * column 0, and only its closing bracket returns there.
 */
export function countJqOutputs(stdout: string, compact: boolean): number {
  if (stdout === "") return 0;
  if (compact) return stdout.split("\n").filter((l) => l !== "").length;
  let n = 0;
  for (const line of stdout.split("\n")) {
    if (line !== "" && line[0] !== " " && line !== "}" && line !== "]" && line !== "}," && line !== "],") n++;
  }
  return n;
}
