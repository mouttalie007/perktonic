import { prisma } from "@/lib/prisma";
import { siteSettingsService } from "@/services/site-settings.service";
import { PageHeader, Card, Input, Button, Checkbox } from "@/components/admin/ui";
import { setFeatured } from "@/app/actions/admin-homepage";
import { updateSiteSettings } from "@/app/actions/admin-settings";

export default async function HomepageConfigPage() {
  const [featured, others, settings] = await Promise.all([
    prisma.article.findMany({
      where: { status: "PUBLISHED", isFeatured: true },
      orderBy: [{ manualPriority: "asc" }, { publishedAt: "desc" }],
    }),
    prisma.article.findMany({
      where: { status: "PUBLISHED", isFeatured: false },
      orderBy: { publishedAt: "desc" },
      take: 20,
    }),
    siteSettingsService.getSiteSettings(),
  ]);

  return (
    <div>
      <PageHeader
        title="Homepage"
        description="Hero picks (spec: 1 primary + 2 secondary — the first 3, in priority order) and the trending ticker."
      />

      <Card className="mb-8">
        <form action={updateSiteSettings} className="flex items-center gap-3">
          <Checkbox label="Show trending ticker in the utility bar" name="tickerEnabled" defaultChecked={settings.tickerEnabled} />
          {/* keep other SiteSettings fields intact on this partial save */}
          <input type="hidden" name="siteName" value={settings.siteName} />
          <input type="hidden" name="tagline" value={settings.tagline} />
          <input type="hidden" name="logoUrl" value={settings.logoUrl ?? ""} />
          <input type="hidden" name="defaultOgImageUrl" value={settings.defaultOgImageUrl ?? ""} />
          <input type="hidden" name="contactEmail" value={settings.contactEmail ?? ""} />
          <input type="hidden" name="facebookUrl" value={settings.facebookUrl ?? ""} />
          <input type="hidden" name="xUrl" value={settings.xUrl ?? ""} />
          <input type="hidden" name="instagramUrl" value={settings.instagramUrl ?? ""} />
          <input type="hidden" name="youtubeUrl" value={settings.youtubeUrl ?? ""} />
          <input type="hidden" name="tiktokUrl" value={settings.tiktokUrl ?? ""} />
          <Button type="submit" variant="secondary" className="text-xs">
            Save
          </Button>
        </form>
      </Card>

      <h2 className="mb-2 font-bold">Hero picks ({featured.length})</h2>
      <div className="mb-8 space-y-2">
        {featured.length === 0 && <p className="text-muted text-sm">No article is featured — the hero falls back to the latest.</p>}
        {featured.map((a) => (
          <Card key={a.id} className="py-3">
            <form action={setFeatured} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="isFeatured" value="on" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{a.title}</span>
              <Input name="manualPriority" type="number" defaultValue={a.manualPriority ?? ""} placeholder="order" className="w-24" />
              <Button type="submit" variant="secondary" className="text-xs">
                Update
              </Button>
            </form>
            <form action={setFeatured} className="mt-1">
              <input type="hidden" name="id" value={a.id} />
              <button type="submit" className="text-accent-red text-xs font-bold hover:underline">
                Remove from hero
              </button>
            </form>
          </Card>
        ))}
      </div>

      <h2 className="mb-2 font-bold">Add to hero</h2>
      <div className="space-y-2">
        {others.map((a) => (
          <Card key={a.id} className="py-3">
            <form action={setFeatured} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="isFeatured" value="on" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{a.title}</span>
              <Button type="submit" variant="secondary" className="text-xs">
                Feature
              </Button>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
