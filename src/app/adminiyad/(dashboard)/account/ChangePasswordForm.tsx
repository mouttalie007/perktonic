"use client";

import { useActionState } from "react";
import { changePassword, type ChangePasswordState } from "@/app/actions/admin-users";
import { Field, Input, Button } from "@/components/admin/ui";

const initial: ChangePasswordState = { status: "idle" };

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initial);

  return (
    <form action={formAction} className="max-w-sm space-y-4">
      <Field label="Current password" htmlFor="currentPassword" required>
        <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
      </Field>
      <Field label="New password" htmlFor="newPassword" required hint="At least 8 characters.">
        <Input id="newPassword" name="newPassword" type="password" required minLength={8} autoComplete="new-password" />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword" required>
        <Input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" />
      </Field>
      {state.status === "error" && (
        <p role="alert" className="text-accent-red text-sm font-semibold">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
      <p className="text-muted text-xs">You will be signed out and need to log in again.</p>
    </form>
  );
}
