"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { Role } from "@prisma/client";
import { AdminSidebar } from "./AdminSidebar";
import { MenuIcon, CloseIcon } from "@/components/icons";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { logoutAction } from "@/app/actions/admin-auth";

export function AdminShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: Role };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock(open);
  useFocusTrap(panelRef, open, () => setOpen(false));

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="bg-ink-deep hidden w-64 shrink-0 flex-col p-4 text-white lg:flex">
        <Link href="/admin" className="mb-6 block px-3 text-lg font-extrabold">
          Viral<span className="text-brand">Trendly</span>
          <span className="text-white/50"> Admin</span>
        </Link>
        <AdminSidebar role={user.role} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-[110] bg-black/50 lg:hidden"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Admin menu"
            className="bg-ink-deep animate-slide-in-right flex h-full w-72 flex-col overflow-y-auto p-4 text-white"
          >
            <div className="mb-6 flex items-center justify-between">
              <span className="text-lg font-extrabold">
                Viral<span className="text-brand">Trendly</span>
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="p-1"
              >
                <CloseIcon width={22} height={22} aria-hidden={false} />
              </button>
            </div>
            <AdminSidebar role={user.role} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-line bg-canvas flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="text-ink -ml-1 p-1 lg:hidden"
            >
              <MenuIcon width={22} height={22} aria-hidden={false} />
            </button>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="text-muted hover:text-ink hidden text-sm font-semibold sm:inline"
            >
              View site ↗
            </a>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold">{user.name}</p>
              <p className="text-muted text-xs">{user.role}</p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="border-line text-ink hover:bg-surface rounded-sm border px-3 py-1.5 text-xs font-bold transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
