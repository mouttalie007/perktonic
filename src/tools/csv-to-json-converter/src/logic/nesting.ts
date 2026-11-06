import type { JsonObject, JsonValue } from "./values";

export type ArrayMode = "index" | "json";

function isPlainObject(v: JsonValue): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Turns {"a":{"b":1},"tags":["x","y"]} into {"a.b":1,"tags.0":"x","tags.1":"y"}
 * ("index" mode) or {"a.b":1,"tags":"[\"x\",\"y\"]"} ("json" mode).
 * In "index" mode empty arrays and objects add no column, so a round trip
 * back to JSON does not create keys that clash with real nested values.
 */
export function flatten(value: JsonValue, separator: string, arrays: ArrayMode): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
  const walk = (v: JsonValue, prefix: string) => {
    if (isPlainObject(v)) {
      const keys = Object.keys(v);
      if (keys.length === 0 && prefix && arrays === "json") out[prefix] = "{}";
      for (const k of keys) walk(v[k], prefix ? prefix + separator + k : k);
      return;
    }
    if (Array.isArray(v)) {
      if (arrays === "json") {
        if (prefix) out[prefix] = JSON.stringify(v);
        return;
      }
      v.forEach((item, i) => walk(item, prefix ? prefix + separator + i : String(i)));
      return;
    }
    out[prefix || "value"] = v;
  };
  walk(value, "");
  return out;
}

export interface UnflattenResult {
  value: JsonObject;
  /** Keys that could not be nested because a parent already held a plain value. */
  conflicts: string[];
}

/**
 * Builds nested objects from flat keys. With `arrays` on, all-numeric path
 * segments (items.0.sku) create arrays instead of objects.
 */
export function unflatten(flat: Record<string, JsonValue>, separator: string, arrays: boolean): UnflattenResult {
  const root: JsonObject = {};
  const conflicts: string[] = [];
  if (separator === "") return { value: { ...flat }, conflicts };

  for (const [key, val] of Object.entries(flat)) {
    const parts = key.split(separator);
    if (parts.some((p) => p === "")) {
      root[key] = val;
      continue;
    }
    let node: JsonObject | JsonValue[] = root;
    let ok = true;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      const nextIsIndex = arrays && /^\d+$/.test(parts[i + 1]);
      const existing: JsonValue | undefined = Array.isArray(node) ? node[Number(part)] : node[part];
      let child: JsonValue;
      if (existing === undefined || existing === null) {
        child = nextIsIndex ? [] : {};
        if (Array.isArray(node)) node[Number(part)] = child;
        else node[part] = child;
      } else if (typeof existing === "object") {
        child = existing;
      } else {
        ok = false;
        break;
      }
      node = child as JsonObject | JsonValue[];
    }
    const last = parts[parts.length - 1];
    if (!ok) {
      conflicts.push(key);
      root[key] = val;
      continue;
    }
    if (Array.isArray(node)) {
      node[Number(last)] = val;
    } else if (node[last] !== undefined && typeof node[last] === "object" && node[last] !== null) {
      conflicts.push(key);
      root[key] = val;
    } else {
      node[last] = val;
    }
  }
  return { value: root, conflicts };
}
