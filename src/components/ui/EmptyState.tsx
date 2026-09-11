import type { ReactNode } from "react";

/** Professional empty state (spec §56) — never a raw "no results" or a stack trace. */
export function EmptyState({
  title,
  description,
  action,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border-line flex flex-col items-center rounded-sm border border-dashed px-6 py-16 text-center ${className}`}
    >
      <h2 className="text-lg font-bold">{title}</h2>
      {description && (
        <p className="text-muted mt-2 max-w-sm text-sm">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
