import { brandIconResponse } from "@/lib/brand-icon";

/** Crawlers and old browsers still ask for /favicon.ico directly; answer with the same "P". */
export function GET() {
  return brandIconResponse(48);
}
