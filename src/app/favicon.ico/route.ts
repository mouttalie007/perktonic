import { readFile } from "node:fs/promises";
import path from "node:path";

/** Crawlers and old browsers still ask for /favicon.ico directly; answer with the logo mark (48 px PNG). */
export async function GET() {
  const png = await readFile(path.join(process.cwd(), "public", "brand", "favicon-48.png"));
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
  });
}
