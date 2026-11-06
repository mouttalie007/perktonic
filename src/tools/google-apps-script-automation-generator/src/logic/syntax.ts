// Server-side syntax check of the generated script with acorn (V8 runtime ≈ modern JavaScript, script mode).
import { parse } from "acorn";

export type SyntaxResult = { ok: true } | { ok: false; line: number; column: number; message: string };

export function checkSyntax(script: string): SyntaxResult {
  try {
    parse(script, { ecmaVersion: 2022, sourceType: "script", locations: true });
    return { ok: true };
  } catch (e) {
    const err = e as { loc?: { line: number; column: number }; message?: string };
    const message = (err.message ?? "Syntax error").replace(/\s*\(\d+:\d+\)$/, "");
    return { ok: false, line: err.loc?.line ?? 1, column: (err.loc?.column ?? 0) + 1, message };
  }
}
