import { Validator, type OutputUnit, type Schema } from "@cfworker/json-schema";
import { pathString, resolvePointer } from "./format";
import type { Node } from "./parser";

export type Draft = "auto" | "7" | "2019-09" | "2020-12" | "4";

export interface SchemaIssue {
  path: string;
  /** Offset in the document (the key if there is one, else the value), for line/column. */
  offset: number;
  keyword: string;
  message: string;
}

/** Plain JS value for the validator. Integers beyond 2^53 become the nearest double here (the formatted output is not affected). */
export function toJs(node: Node): unknown {
  switch (node.t) {
    case "object": {
      const o: Record<string, unknown> = {};
      node.keys.forEach((k, i) => {
        o[k] = toJs(node.values[i]);
      });
      return o;
    }
    case "array":
      return node.items.map(toJs);
    case "string":
      return node.value;
    case "number":
      return Number(node.raw);
    case "boolean":
      return node.value;
    case "null":
      return null;
  }
}

export function detectDraft(schema: unknown): Exclude<Draft, "auto"> {
  const id = schema && typeof schema === "object" ? String((schema as Record<string, unknown>).$schema ?? "") : "";
  if (id.includes("draft-07")) return "7";
  if (id.includes("draft-04")) return "4";
  if (id.includes("2019-09")) return "2019-09";
  return "2020-12";
}

// Errors that only say "a child failed"; the child's own error is kept instead.
const WRAPPERS = new Set(["properties", "items", "prefixItems", "additionalItems", "allOf", "$ref", "$dynamicRef", "patternProperties", "dependentSchemas", "contains", "then", "else", "if"]);

function friendly(u: OutputUnit): string {
  const m = u.error;
  let r = /^Instance type "(\w+)" is invalid\. Expected "([^"]+)"\.$/.exec(m);
  if (r) return `Expected ${r[2].replace(/","/g, " or ")}, got ${r[1]}.`;
  r = /^Instance does not have required property "(.+)"\.$/.exec(m);
  if (r) return `Required property "${r[1]}" is missing.`;
  r = /^Property "(.+)" does not match additional properties schema\.$/.exec(m);
  if (r) return `Property "${r[1]}" is not allowed (additionalProperties is false).`;
  return m;
}

/**
 * Validates with @cfworker/json-schema, which interprets the schema instead
 * of generating code (no eval/new Function), and reduces its output to the
 * errors a person needs: the innermost failures, each with a $.path.
 */
export function validateSchema(doc: Node, schemaNode: Node, draft: Draft): { valid: boolean; draft: Exclude<Draft, "auto">; issues: SchemaIssue[] } {
  const schema = toJs(schemaNode);
  if (typeof schema !== "boolean" && (schema === null || typeof schema !== "object" || Array.isArray(schema))) {
    throw new Error("The schema must be a JSON object (or true/false).");
  }
  const used = draft === "auto" ? detectDraft(schema) : draft;
  const result = new Validator(schema as Schema | boolean, used, false).validate(toJs(doc));
  if (result.valid) return { valid: true, draft: used, issues: [] };

  const errors = result.errors;
  // A property that fails its own schema is also reported under additionalProperties by the validator; drop that echo.
  const failedProps = new Set(errors.filter((e) => e.keyword === "properties").map((e) => `${e.instanceLocation}|${/^Property "(.+)" does not match schema\.$/.exec(e.error)?.[1] ?? ""}`));
  const echoed = new Set<string>();
  const kept: OutputUnit[] = [];
  const branchRoots = errors.filter((e) => e.keyword === "anyOf" || e.keyword === "oneOf" || e.keyword === "not").map((e) => e.keywordLocation);
  for (const e of errors) {
    if (branchRoots.some((root) => e.keywordLocation.startsWith(root + "/"))) continue;
    if (e.keyword === "additionalProperties" || e.keyword === "unevaluatedProperties") {
      const prop = /^Property "(.+)" does not match/.exec(e.error)?.[1] ?? "";
      const child = `${e.instanceLocation === "#" ? "#" : e.instanceLocation}/${prop}`;
      if (failedProps.has(`${e.instanceLocation}|${prop}`)) {
        echoed.add(child);
        continue;
      }
      echoed.add(child);
      kept.push(e);
      continue;
    }
    if (e.keyword === "false" && echoed.has(e.instanceLocation)) continue;
    if (WRAPPERS.has(e.keyword) && /does not match|did not match/.test(e.error)) continue;
    kept.push(e);
  }
  const seen = new Set<string>();
  const issues: SchemaIssue[] = [];
  for (const e of kept) {
    let location = e.instanceLocation;
    if (e.keyword === "additionalProperties" || e.keyword === "unevaluatedProperties") {
      // Point at the extra property itself rather than at its parent object.
      const prop = /^Property "(.+)" does not match/.exec(e.error)?.[1];
      if (prop !== undefined) location = `${location}/${prop.replace(/~/g, "~0").replace(/\//g, "~1")}`;
    }
    const where = resolvePointer(doc, location);
    const message = friendly(e);
    const id = `${e.instanceLocation}|${message}`;
    if (seen.has(id)) continue;
    seen.add(id);
    issues.push({ path: where ? pathString(where.steps) : e.instanceLocation, offset: where ? where.keyAt ?? where.node.at : 0, keyword: e.keyword, message });
  }
  issues.sort((a, b) => a.offset - b.offset);
  return { valid: false, draft: used, issues };
}
