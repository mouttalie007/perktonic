import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Select, Checkbox, Input, Button, Badge } from "@/components/admin/ui";
import { updateAdPlacement } from "@/app/actions/admin-ads";

export default async function AdPlacementsPage() {
  const [placements, units] = await Promise.all([
    prisma.adPlacement.findMany({ orderBy: { order: "asc" } }),
    prisma.adUnit.findMany({ where: { enabled: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Ad Placements"
        description="The fixed slots in the site templates — map each to an Ad Unit."
      />
      <div className="space-y-4">
        {placements.map((p) => (
          <Card key={p.id}>
            <form action={updateAdPlacement} className="space-y-3">
              <input type="hidden" name="id" value={p.id} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-bold">
                    {p.label} <span className="text-muted font-mono text-xs">({p.placementKey})</span>
                  </h2>
                  {p.description && <p className="text-muted text-sm">{p.description}</p>}
                </div>
                <Badge tone={p.enabled ? "success" : "default"}>{p.enabled ? "Enabled" : "Disabled"}</Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold">Ad unit</label>
                  <Select name="adUnitId" defaultValue={p.adUnitId ?? ""}>
                    <option value="">None (slot stays empty)</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex items-end">
                  <Checkbox label="Enabled" name="enabled" defaultChecked={p.enabled} />
                </div>
              </div>

              {p.placementKey === "in-content" || p.placementKey === "between-slides" ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="flex items-center gap-2 text-sm sm:col-span-1">
                    <input type="checkbox" name="autoInject" defaultChecked={p.autoInject} className="border-line h-4 w-4" />
                    Auto-inject
                  </label>
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Every N paragraphs</label>
                    <Input name="everyNParagraphs" type="number" defaultValue={p.everyNParagraphs ?? ""} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Max per article</label>
                    <Input name="maxInjections" type="number" defaultValue={p.maxInjections ?? ""} />
                  </div>
                </div>
              ) : null}

              <Button type="submit" variant="secondary" className="text-xs">
                Save
              </Button>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
