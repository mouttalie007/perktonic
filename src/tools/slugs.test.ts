import { describe, expect, it } from "vitest";
import { TOOLS } from "@/config/tools";
import { RUNNER_SLUGS } from "./ToolRunner";
import { TOOL_SLUGS } from "./slugs";

describe("tool registry", () => {
  it("the slug list and the runner map name the same tools", () => {
    expect([...TOOL_SLUGS].sort()).toEqual([...RUNNER_SLUGS].sort());
  });
  it("every live tool has a component", () => {
    for (const t of TOOLS.filter((x) => x.status === "live")) expect(TOOL_SLUGS.has(t.slug), t.slug).toBe(true);
  });
});
