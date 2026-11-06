// @vitest-environment jsdom
import { createRoot } from "react-dom/client";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { SeoChecklist } from "./SeoChecklist";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("SeoChecklist", () => {
  it("reads the surrounding form and shows a score and the failing checks", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const form = document.createElement("form");
    host.appendChild(form);
    for (const [name, value] of Object.entries({ title: "Fix #REF! in Excel VLOOKUP", slug: "fix-ref-error", excerpt: "", seoTitle: "", metaDescription: "", content: "<p>Short</p>", featuredImageId: "" })) {
      const i = document.createElement("input");
      i.type = "hidden";
      i.name = name;
      i.value = value;
      form.appendChild(i);
    }
    const mount = document.createElement("div");
    form.appendChild(mount);
    await act(async () => {
      createRoot(mount).render(<SeoChecklist siteHost="perktonic.com" />);
    });
    expect(mount.textContent).toContain("SEO check");
    expect(mount.textContent).toMatch(/\d+\/100/);
    expect(mount.textContent).toContain("Meta description");
    expect(mount.textContent).toContain("Link to a tool");
  });
});
