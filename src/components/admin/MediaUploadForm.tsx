"use client";

import { useActionState, useRef } from "react";
import { uploadMedia, type UploadState } from "@/app/actions/admin-media";
import { Field, Input, Button } from "./ui";

const initial: UploadState = { status: "idle" };

export function MediaUploadForm() {
  const [state, formAction, pending] = useActionState(uploadMedia, initial);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await formAction(fd);
        formRef.current?.reset();
      }}
      className="grid gap-3 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end"
    >
      <Field label="Image" htmlFor="file">
        <input id="file" name="file" type="file" accept="image/*" required className="text-sm" />
      </Field>
      <Field label="Alt text" htmlFor="alt" hint="Describes the image for screen readers & SEO.">
        <Input id="alt" name="alt" />
      </Field>
      <Field label="Credit" htmlFor="credit">
        <Input id="credit" name="credit" placeholder="Photo: Jane Doe" />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Uploading…" : "Upload"}
      </Button>
      {state.status !== "idle" && (
        <p
          className={`sm:col-span-4 text-sm ${state.status === "error" ? "text-accent-red" : "text-green-700"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
