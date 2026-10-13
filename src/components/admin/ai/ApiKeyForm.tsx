"use client";

import { useState, useTransition } from "react";
import {
  clearApiKeyAction,
  saveApiKeyAction,
  testApiKeyAction,
  type KeyActionResult,
} from "@/app/actions/admin-ai-articles";
import type { KeyStatus } from "@/lib/ai-article/api-key";
import { Badge, Button, Field, Input } from "../ui";

export function ApiKeyForm({ status }: { status: KeyStatus }) {
  const [result, setResult] = useState<KeyActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState("");

  function save() {
    const fd = new FormData();
    fd.append("apiKey", value);
    startTransition(async () => {
      const res = await saveApiKeyAction(fd);
      setResult(res);
      if (res.ok) {
        setValue("");
        window.location.reload();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold">Current key:</span>
        {status.configured ? (
          <>
            <code className="bg-surface rounded-sm px-2 py-0.5 text-xs">
              {status.masked}
            </code>
            <Badge tone="success">
              {status.source === "env" ? "from server env" : "saved here"}
            </Badge>
          </>
        ) : (
          <Badge tone="danger">not set</Badge>
        )}
      </div>

      <Field
        label="New Claude API key"
        htmlFor="apiKey"
        hint="Starts with sk-ant-. Pasting a new key replaces the saved one."
      >
        <Input
          id="apiKey"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="sk-ant-…"
        />
      </Field>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={save}
          disabled={pending || !value.trim()}
        >
          {pending ? "Saving…" : "Save key"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !status.configured}
          onClick={() =>
            startTransition(async () => setResult(await testApiKeyAction()))
          }
        >
          Test key (free)
        </Button>
        {status.source === "settings" && (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Remove the saved key?")) return;
              startTransition(async () => {
                const res = await clearApiKeyAction();
                setResult(res);
                if (res.ok) window.location.reload();
              });
            }}
          >
            Remove saved key
          </Button>
        )}
      </div>

      {result && (
        <p
          role="status"
          className={`rounded-sm p-3 text-sm font-semibold ${
            result.ok
              ? "bg-green-50 text-green-800"
              : "bg-accent-red/10 text-accent-red"
          }`}
        >
          {result.ok ? result.message : result.error}
        </p>
      )}
    </div>
  );
}
