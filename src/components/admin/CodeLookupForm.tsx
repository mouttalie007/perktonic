"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { lookupQuizCodeAction, type LookupCodeResult } from "@/app/actions/admin-quiz";
import { formatDateLong } from "@/lib/format";
import { Input, Button } from "./ui";

export function CodeLookupForm() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<LookupCodeResult | null>(null);
  const [checking, startChecking] = useTransition();

  function handleCheck() {
    if (!code.trim()) return;
    startChecking(async () => {
      const res = await lookupQuizCodeAction(code);
      setResult(res);
    });
  }

  return (
    <div>
      <div className="flex gap-3">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCheck()}
          placeholder="e.g. X6E8"
          className="max-w-48 font-mono uppercase"
          maxLength={8}
        />
        <Button type="button" onClick={handleCheck} disabled={checking || !code.trim()}>
          {checking ? "Checking…" : "Check code"}
        </Button>
      </div>

      {result && (
        <div className="mt-4">
          {!result.ok && (
            <p className="bg-accent-red/10 text-accent-red rounded-sm p-3 text-sm font-semibold">
              {result.error}
            </p>
          )}

          {result.ok && !result.alreadyChecked && (
            <p className="rounded-sm bg-green-50 p-3 text-sm font-semibold text-green-800">
              ✓ Valid — first time this code has been checked. From article:{" "}
              <Link href={`/story/${result.articleSlug}` as Route} className="underline" target="_blank">
                {result.articleTitle}
              </Link>
            </p>
          )}

          {result.ok && result.alreadyChecked && (
            <p className="bg-accent-red/10 text-accent-red rounded-sm p-3 text-sm font-semibold">
              ⚠ Already checked before
              {result.firstCheckedAt && ` on ${formatDateLong(result.firstCheckedAt)}`}. From article:{" "}
              <Link href={`/story/${result.articleSlug}` as Route} className="underline" target="_blank">
                {result.articleTitle}
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
