import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { callLlmWith, extractJson, MAX_USER_CHARS, resetLlmState, type Completion, type LlmDeps } from "./llm";

const schema = z.object({ answer: z.string() });
const base = { tool: "t", system: "s", user: "u", schema, maxOutputTokens: 100 };

function deps(replies: (Completion | Error)[], o: Partial<LlmDeps> = {}) {
  let calls = 0;
  const d: LlmDeps = {
    complete: async () => {
      const r = replies[Math.min(calls++, replies.length - 1)]!;
      if (r instanceof Error) throw r;
      return r;
    },
    now: () => Date.UTC(2026, 10, 1, 12),
    model: () => "claude-haiku-5-5",
    dailyUsd: () => 5,
    ...o,
  };
  return { d, calls: () => calls };
}
const ok = (text: string, inputTokens = 100, outputTokens = 50): Completion => ({ text, inputTokens, outputTokens, refused: false });

beforeEach(resetLlmState);

describe("extractJson", () => {
  it("reads fenced and prefixed JSON", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here you go: {"a":{"b":2}} done')).toEqual({ a: { b: 2 } });
  });
  it("throws without an object", () => expect(() => extractJson("nope")).toThrow());
});

describe("callLlmWith", () => {
  it("returns valid data", async () => {
    const { d } = deps([ok('{"answer":"x"}')]);
    expect(await callLlmWith(d, base)).toEqual({ ok: true, data: { answer: "x" }, cached: false });
  });
  it("answers too_long without calling the model", async () => {
    const { d, calls } = deps([ok("{}")]);
    const r = await callLlmWith(d, { ...base, user: "x".repeat(MAX_USER_CHARS + 1) });
    expect(r).toMatchObject({ ok: false, code: "too_long" });
    expect(calls()).toBe(0);
  });
  it("serves an identical request from the cache", async () => {
    const { d, calls } = deps([ok('{"answer":"x"}')]);
    await callLlmWith(d, base);
    expect(await callLlmWith(d, base)).toMatchObject({ ok: true, cached: true });
    expect(calls()).toBe(1);
  });
  it("retries once when the JSON does not fit the schema", async () => {
    const { d, calls } = deps([ok('{"wrong":1}'), ok('{"answer":"fixed"}')]);
    expect(await callLlmWith(d, base)).toMatchObject({ ok: true, data: { answer: "fixed" } });
    expect(calls()).toBe(2);
  });
  it("gives invalid_output after two bad answers", async () => {
    const { d, calls } = deps([ok("nonsense")]);
    expect(await callLlmWith(d, base)).toMatchObject({ ok: false, code: "invalid_output" });
    expect(calls()).toBe(2);
  });
  it("maps a refusal and an API failure", async () => {
    expect(await callLlmWith(deps([{ ...ok(""), refused: true }]).d, base)).toMatchObject({ code: "invalid_output" });
    expect(await callLlmWith(deps([new Error("503")]).d, base)).toMatchObject({ code: "upstream" });
  });
  it("appends the JSON Schema of the expected answer to the system prompt", async () => {
    let system = "";
    const d: LlmDeps = { ...deps([]).d, complete: async (a) => { system = a.system; return ok('{"answer":"x"}'); } };
    await callLlmWith(d, base);
    expect(system).toContain("JSON Schema");
    expect(system).toContain("\"answer\"");
  });
  it("stops with quota once the day's budget is spent, and resets the next day", async () => {
    let t = Date.UTC(2026, 10, 1, 12);
    const { d } = deps([ok('{"answer":"x"}', 1_000_000, 0)], { now: () => t, dailyUsd: () => 0.05 }); // 1M input tokens at $0.10 = $0.10
    expect(await callLlmWith(d, { ...base, user: "a" })).toMatchObject({ ok: true });
    expect(await callLlmWith(d, { ...base, user: "b" })).toMatchObject({ ok: false, code: "quota" });
    t += 24 * 3600 * 1000;
    expect(await callLlmWith(d, { ...base, user: "c" })).toMatchObject({ ok: true });
  });
});
