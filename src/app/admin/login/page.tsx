import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in — ViralTrendly Admin", robots: { index: false, follow: false } };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/admin");

  return (
    <div className="bg-surface flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-2xl font-extrabold tracking-tight">
            Viral<span className="text-brand-ink">Trendly</span>
            <span>.com</span>
          </span>
          <p className="text-muted mt-1 text-xs font-semibold tracking-[0.2em] uppercase">
            Admin
          </p>
        </div>
        <div className="border-line bg-canvas rounded-md border p-6 shadow-[var(--shadow-raised)]">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
