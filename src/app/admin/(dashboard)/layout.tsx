import type { ReactNode } from "react";
import type { Metadata } from "next";
import { requireUser } from "@/lib/require-admin";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s — ViralTrendly Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  return <AdminShell user={user}>{children}</AdminShell>;
}
