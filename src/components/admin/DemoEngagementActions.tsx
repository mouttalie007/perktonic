"use client";

import { useState } from "react";
import { applyDemoEngagementNow, clearDemoEngagementNow } from "@/app/actions/demo-engagement";
import { Button } from "./ui";

/**
 * The two one-click actions for pre-launch demo engagement (perktonic
 * workflow, 2026-10-09). Client component only so each button can show its
 * own result inline without a full page reload.
 */
export function DemoEngagementActions() {
  const [applyResult, setApplyResult] = useState<string | null>(null);
  const [clearResult, setClearResult] = useState<string | null>(null);
  const [pending, setPending] = useState<"apply" | "clear" | null>(null);

  async function apply() {
    setPending("apply");
    setApplyResult(null);
    const { count } = await applyDemoEngagementNow();
    setApplyResult(
      count === 0
        ? "Nothing to do — every published article already has engagement."
        : `Applied demo engagement to ${count} article(s).`,
    );
    setPending(null);
  }

  async function clear() {
    if (!window.confirm("Remove all demo reactions and comments from every article? This can't be undone.")) {
      return;
    }
    setPending("clear");
    setClearResult(null);
    const result = await clearDemoEngagementNow();
    setClearResult(`Removed ${result.comments} comment(s) and reset reactions on every article.`);
    setPending(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <Button type="button" onClick={apply} disabled={pending !== null}>
          {pending === "apply" ? "Applying…" : "Apply to articles missing engagement"}
        </Button>
        {applyResult && <p className="text-muted mt-2 text-sm">{applyResult}</p>}
      </div>
      <div>
        <Button type="button" variant="danger" onClick={clear} disabled={pending !== null}>
          {pending === "clear" ? "Clearing…" : "Clear all demo engagement"}
        </Button>
        {clearResult && <p className="text-muted mt-2 text-sm">{clearResult}</p>}
      </div>
    </div>
  );
}
