import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Field, Input, Select, Checkbox, Button, EmptyRow } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { createRedirect, deleteRedirect, toggleRedirect } from "@/app/actions/admin-redirects";

export default async function RedirectsPage() {
  const redirects = await prisma.redirect.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div>
        <PageHeader title="Redirects" description="Applied site-wide, refreshed every ~60 seconds." />
        <div className="border-line overflow-x-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-muted text-xs font-bold tracking-wide uppercase">
              <tr>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Hits</th>
                <th className="px-4 py-3">Enabled</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {redirects.length === 0 && <EmptyRow colSpan={6}>No redirects yet.</EmptyRow>}
              {redirects.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-mono text-xs">{r.fromPath}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.toPath}</td>
                  <td className="px-4 py-3">{r.statusCode}</td>
                  <td className="px-4 py-3">{r.hits}</td>
                  <td className="px-4 py-3">
                    <form action={toggleRedirect}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="enabled" value={r.enabled ? "" : "on"} />
                      <button type="submit" className="text-accent-blue text-xs font-bold hover:underline">
                        {r.enabled ? "On" : "Off"}
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={deleteRedirect}>
                      <input type="hidden" name="id" value={r.id} />
                      <DeleteButton />
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Card className="h-fit space-y-4">
        <h2 className="font-bold">New redirect</h2>
        <form action={createRedirect} className="space-y-3">
          <Field label="From path" htmlFor="fromPath" hint="e.g. /old-page">
            <Input id="fromPath" name="fromPath" required placeholder="/old-page" />
          </Field>
          <Field label="To path or URL" htmlFor="toPath">
            <Input id="toPath" name="toPath" required placeholder="/new-page" />
          </Field>
          <Field label="Status code" htmlFor="statusCode">
            <Select id="statusCode" name="statusCode" defaultValue="301">
              <option value="301">301 — Permanent</option>
              <option value="302">302 — Temporary</option>
              <option value="307">307 — Temporary (method preserved)</option>
              <option value="308">308 — Permanent (method preserved)</option>
            </Select>
          </Field>
          <Checkbox label="Enabled" name="enabled" defaultChecked />
          <Button type="submit" className="w-full justify-center">
            Add redirect
          </Button>
        </form>
      </Card>
    </div>
  );
}
