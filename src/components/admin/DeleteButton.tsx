"use client";

/** Submit button that asks for confirmation before letting the form post. */
export function DeleteButton({
  label = "Delete",
  confirmText = "Delete this? This cannot be undone.",
}: {
  label?: string;
  confirmText?: string;
}) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
      className="text-accent-red text-xs font-bold hover:underline"
    >
      {label}
    </button>
  );
}
