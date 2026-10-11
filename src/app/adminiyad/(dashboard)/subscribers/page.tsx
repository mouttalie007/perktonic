import { prisma } from "@/lib/prisma";
import { PageHeader, Badge, EmptyRow } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";

export default async function SubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const [subscribers, counts] = await Promise.all([
    prisma.newsletterSubscriber.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.newsletterSubscriber.groupBy({ by: ["status"], _count: true }),
  ]);

  return (
    <div>
      <PageHeader
        title="Newsletter Subscribers"
        description="Never exposed publicly. Provider hand-off is configured under Site Settings."
      />

      <div className="mb-4 flex gap-4 text-sm">
        {counts.map((c) => (
          <span key={c.status} className="text-muted">
            <span className="text-ink font-bold">{c._count}</span> {c.status}
          </span>
        ))}
      </div>

      <div className="border-line overflow-x-auto rounded-md border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-muted text-xs font-bold tracking-wide uppercase">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Subscribed</th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {subscribers.length === 0 && <EmptyRow colSpan={4}>No subscribers yet.</EmptyRow>}
            {subscribers.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-semibold">{s.email}</td>
                <td className="px-4 py-3">
                  <Badge tone={s.status === "subscribed" ? "success" : s.status === "unsubscribed" ? "default" : "warning"}>
                    {s.status}
                  </Badge>
                </td>
                <td className="text-muted px-4 py-3">{s.source ?? "—"}</td>
                <td className="text-muted px-4 py-3">{formatDate(s.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
