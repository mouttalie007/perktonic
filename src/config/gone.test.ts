import { describe, expect, it } from "vitest";
import { isGonePath } from "./gone";

describe("isGonePath", () => {
  it("flags removed pages of the old site", () => {
    expect(isGonePath("/blog/free-samples-by-mail")).toBe(true);
    expect(isGonePath("/story/best-cashback-apps")).toBe(true);
    expect(isGonePath("/category/money-saving")).toBe(true);
    expect(isGonePath("/author/alex-carter")).toBe(true);
    expect(isGonePath("/tag/wellness")).toBe(true);
  });
  it("leaves the current site alone", () => {
    expect(isGonePath("/blog/fix-div-0-error-excel")).toBe(false);
    expect(isGonePath("/category/web-diagnostics")).toBe(false);
    expect(isGonePath("/author/perktonic-team")).toBe(false);
    expect(isGonePath("/tools/pdf-to-excel")).toBe(false);
  });
});
