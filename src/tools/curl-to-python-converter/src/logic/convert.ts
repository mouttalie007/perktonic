import { parseCurl } from "./curl";
import { generate, type Generated, type Target } from "./generate";
import { ConvertError, tooLarge, type Request } from "./model";
import { fromFetch, fromPython, toCurl } from "./reverse";

export type InputKind = "curl" | "python" | "fetch";

export function detectInput(text: string): InputKind | null {
  const t = text.trim();
  if (t === "") return null;
  if (/^(\S*\/)?curl(\.exe)?(\s|$)/.test(t)) return "curl";
  if (/\brequests\.(get|post|put|patch|delete|head|options|request)\s*\(|^\s*import requests/m.test(t)) return "python";
  if (/\bfetch\s*\(/.test(t)) return "fetch";
  return null;
}

export type Result =
  | { direction: "to-code"; request: Request; output: Generated }
  | { direction: "to-curl"; source: "python" | "fetch"; request: Request; curl: string };

export function convert(text: string, target: Target): Result {
  const big = tooLarge(text);
  if (big) throw new ConvertError(big);
  const kind = detectInput(text);
  if (kind === null) {
    throw new ConvertError("Paste a curl command, or a Python requests or JavaScript fetch snippet to turn into curl. Other languages (axios, PHP, Go, httpx…) can only be produced, not read.");
  }
  if (kind === "curl") {
    const request = parseCurl(text);
    return { direction: "to-code", request, output: generate(request, target) };
  }
  const request = kind === "python" ? fromPython(text) : fromFetch(text);
  return { direction: "to-curl", source: kind, request, curl: toCurl(request) };
}
