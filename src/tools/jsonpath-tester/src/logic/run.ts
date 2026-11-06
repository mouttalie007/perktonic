import type { JSONPath as JSONPathFn } from "jsonpath-plus";
import type { Jq } from "jq-wasm";
import { countJqOutputs, friendlyJqError, type FriendlyError } from "./jq-errors";
import { ExpressionError, explainJsonPath } from "./jsonpath-explain";
import { pointerAt } from "./input";

export type Language = "jsonpath" | "jq";

export interface JqOptions {
  /** -c: one output per line. */
  compact: boolean;
  /** -r: strings without quotes. */
  raw: boolean;
}

export interface QueryResult {
  output: string;
  count: number;
  /** JSONPath only: the normalized path of each match, e.g. $['orders'][0]['id']. */
  paths: string[];
  /** jq can fail after producing some output; both are shown. */
  error: FriendlyError | null;
}

export function expressionError(e: ExpressionError, expression: string): FriendlyError {
  const before = expression.slice(0, expression.length - expression.trimStart().length).length;
  const at = Math.min(e.index + before, expression.length);
  const lines = expression.slice(0, at).split("\n");
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;
  return { message: e.message, hint: null, line, column, pointer: pointerAt(expression, line, column) };
}

/** Runs a JSONPath expression with jsonpath-plus in its safe evaluator (no eval or Function). */
export function runJsonPath(jsonPath: typeof JSONPathFn, doc: unknown, expression: string, compact: boolean): QueryResult {
  try {
    explainJsonPath(expression);
  } catch (e) {
    if (e instanceof ExpressionError) return { output: "", count: 0, paths: [], error: expressionError(e, expression) };
    throw e;
  }
  let matches: { path: string; value: unknown }[];
  try {
    matches = jsonPath({ path: expression.trim(), json: doc as object, eval: "safe", resultType: "all", wrap: true }) as { path: string; value: unknown }[];
  } catch (e) {
    const message = (e as Error).message;
    return {
      output: "",
      count: 0,
      paths: [],
      error: {
        message: `The filter could not run: ${message}.`,
        hint: /Expected expression|Unexpected/.test(message) ? "Filters look like [?(@.price < 10)] or [?(@.status == 'paid' && @.total > 50)]. Strings need quotes." : /not a function|Cannot read prop/.test(message) ? "Some items lack the field used in the filter. Check that it exists first: [?(@.name && @.name.startsWith('A'))]." : null,
        line: null,
        column: null,
        pointer: null,
      },
    };
  }
  const values = matches.map((m) => m.value);
  return { output: compact ? values.map((v) => JSON.stringify(v)).join("\n") : JSON.stringify(values, null, 2), count: values.length, paths: matches.map((m) => m.path), error: null };
}

/** Runs a jq filter with jq 1.8 compiled to WebAssembly. `text` is the document's JSON text, so big numbers keep every digit. */
export function runJq(jq: Jq, text: string, expression: string, options: JqOptions): QueryResult {
  const flags = [...(options.compact ? ["-c"] : []), ...(options.raw ? ["-r"] : [])];
  const r = jq.raw(text, expression, flags);
  const output = r.stdout.replace(/\n$/, "");
  // Exit code 0 with text on stderr comes from debug/stderr calls, which are not errors.
  const error = r.exitCode === 0 || r.stderr.trim() === "" ? null : friendlyJqError(r.stderr, expression);
  return { output, count: options.raw ? output.split("\n").filter((l) => l !== "").length : countJqOutputs(output, options.compact), paths: [], error };
}
