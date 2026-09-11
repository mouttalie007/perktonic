import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/** Shared, unstyled-by-Tailwind-only form primitives for the admin — keeps
 *  ~20 CRUD screens visually consistent without a component library. */

const fieldCls =
  "border-line focus-visible:ring-accent-blue w-full rounded-sm border px-3 py-2 text-sm outline-none focus-visible:ring-2 disabled:bg-surface disabled:text-muted";

export function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
} & { children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold">
        {label}
        {required && <span className="text-accent-red"> *</span>}
      </label>
      {children}
      {hint && <p className="text-muted mt-1 text-xs">{hint}</p>}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldCls} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${fieldCls} ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${fieldCls} bg-white ${props.className ?? ""}`} />
  );
}

export function Checkbox({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <input
        type="checkbox"
        {...props}
        className="border-line h-4 w-4 accent-[var(--color-ink)]"
      />
      {label}
    </label>
  );
}

export function AdminLabel(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...props} className={`text-sm font-semibold ${props.className ?? ""}`} />;
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-line bg-canvas rounded-md border p-5 ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {description && <p className="text-muted mt-1 text-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: {
  variant?: "primary" | "secondary" | "danger" | "ghost";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: "bg-ink text-white hover:bg-ink-deep",
    secondary: "border-line border text-ink hover:bg-surface",
    danger: "bg-accent-red text-white hover:opacity-90",
    ghost: "text-muted hover:text-ink",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-1.5 rounded-sm px-4 py-2 text-sm font-bold transition-colors disabled:opacity-60 ${styles} ${className}`}
    />
  );
}

export function LinkButton({
  href,
  variant = "secondary",
  children,
}: {
  href: string;
  variant?: "primary" | "secondary";
  children: ReactNode;
}) {
  const styles =
    variant === "primary"
      ? "bg-ink text-white hover:bg-ink-deep"
      : "border-line border text-ink hover:bg-surface";
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-sm px-4 py-2 text-sm font-bold transition-colors ${styles}`}
    >
      {children}
    </a>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const styles = {
    default: "bg-surface text-ink",
    success: "bg-green-100 text-green-800",
    warning: "bg-brand/30 text-ink",
    danger: "bg-red-100 text-accent-red",
  }[tone];
  return (
    <span
      className={`inline-block rounded-sm px-2 py-0.5 text-[0.7rem] font-bold tracking-wide uppercase ${styles}`}
    >
      {children}
    </span>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-muted px-4 py-10 text-center text-sm">
        {children}
      </td>
    </tr>
  );
}
