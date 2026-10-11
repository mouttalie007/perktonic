import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, LinkButton, Badge, EmptyRow } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { deleteAdUnit } from "@/app/actions/admin-ads";

export default async function AdUnitsPage() {
  const units = await prisma.adUnit.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { placements: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Ad Units"
        description="Named blocks of ad markup you assign to placements."
        action={<LinkButton href="/adminiyad/ads/units/new" variant="primary">New Ad Unit</LinkButton>}
      />
      <div className="border-line overflow-x-auto rounded-md border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-muted text-xs font-bold tracking-wide uppercase">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Enabled</th>
              <th className="px-4 py-3">In use</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {units.length === 0 && <EmptyRow colSpan={5}>No ad units yet.</EmptyRow>}
            {units.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-semibold">{u.name}</td>
                <td className="text-muted px-4 py-3">{u.key}</td>
                <td className="px-4 py-3">
                  <Badge tone={u.enabled ? "success" : "default"}>{u.enabled ? "Enabled" : "Disabled"}</Badge>
                </td>
                <td className="px-4 py-3">{u._count.placements} placement(s)</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/adminiyad/ads/units/${u.id}/edit`} className="text-accent-blue text-xs font-bold hover:underline">
                      Edit
                    </Link>
                    <form action={deleteAdUnit}>
                      <input type="hidden" name="id" value={u.id} />
                      <DeleteButton />
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted mt-4 text-xs">
        Publisher/account IDs come from environment variables, never typed here. Map units to
        template slots on the <Link href="/adminiyad/ads/placements" className="text-accent-blue hover:underline">Ad Placements</Link> page.
      </p>
    </div>
  );
}
