/**
 * Runs the evals/cases.json of AI tools (kind D) against the REAL model.
 *   npx tsx scripts/run-tool-evals.mts <slug> [<slug> ...] [--json]
 * Every case goes through the tool's own run() so the prompt is exactly what production sends;
 * the raw model answer is then judged by the tool's evals/check.ts. Costs real money (cents):
 * the daily cap of callLlm applies. Set TOOLS_AI_MODEL to compare models.
 */
import fs from "node:fs";
import path from "node:path";
import { callLlm, type LlmResult } from "@/lib/tools/llm";
import { prisma } from "@/lib/prisma";

const slugs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!slugs.length) {
  console.error("Give one or more tool slugs.");
  process.exit(1);
}

type Case = { id: string; input: unknown };
let failed = 0;
let total = 0;
for (const slug of slugs) {
  const dir = path.resolve(import.meta.dirname, "../src/tools", slug);
  const cases = JSON.parse(fs.readFileSync(path.join(dir, "evals/cases.json"), "utf8")) as Case[];
  const { run } = await import(`@/tools/${slug}/src/llm/run`);
  const { checkCase } = await import(`@/tools/${slug}/evals/check`);
  console.log(`\n=== ${slug} (${cases.length} cases, model ${process.env.TOOLS_AI_MODEL || "default"})`);
  for (const c of cases) {
    total++;
    let raw: unknown;
    let err = "";
    const llm = async <T,>(a: Parameters<typeof callLlm<T>>[0]): Promise<LlmResult<T>> => {
      const r = await callLlm(a);
      if (r.ok) raw = r.data;
      else err = `${r.code}: ${r.message}`;
      return r;
    };
    const t0 = Date.now();
    try {
      await run(c.input, { llm });
    } catch (e) {
      err = `run threw: ${e instanceof Error ? e.message : String(e)}`;
    }
    const problems = raw === undefined ? [`no usable answer (${err})`] : checkCase(c, raw);
    const ms = Date.now() - t0;
    if (problems.length) {
      failed++;
      console.log(`FAIL ${c.id} (${ms} ms)\n  - ${problems.join("\n  - ")}`);
      if (process.argv.includes("--json")) console.log("  raw:", JSON.stringify(raw)?.slice(0, 1500));
    } else console.log(`ok   ${c.id} (${ms} ms)`);
  }
}
console.log(`\n${total - failed}/${total} cases passed`);
await prisma.$disconnect();
process.exit(failed ? 1 : 0);
