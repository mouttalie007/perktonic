"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { ADMIN_NAV } from "./nav-config";
import { hasRole } from "@/lib/role-rank";

export function AdminSidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="space-y-6">
      {ADMIN_NAV.map((group) => {
        const items = group.items.filter(
          (i) => !i.minRole || hasRole(role, i.minRole),
        );
        if (items.length === 0) return null;
        return (
          <div key={group.title}>
            <p className="text-meta mb-2 px-3 font-bold tracking-[0.15em] text-white/40 uppercase">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active =
                  item.href === ("/admin" as typeof item.href)
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block rounded-sm px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-white/10 text-white"
                          : "text-white/65 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
