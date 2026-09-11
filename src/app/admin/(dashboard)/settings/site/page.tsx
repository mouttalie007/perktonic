import { siteSettingsService } from "@/services/site-settings.service";
import { PageHeader, Field, Input, Checkbox, Card, Button } from "@/components/admin/ui";
import { updateSiteSettings } from "@/app/actions/admin-settings";

export default async function SiteSettingsPage() {
  const s = await siteSettingsService.getSiteSettings();

  return (
    <div>
      <PageHeader title="Site Settings" description="Branding, contact and social links used across the site." />
      <form action={updateSiteSettings} className="max-w-2xl space-y-6">
        <Card className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Site name" htmlFor="siteName">
              <Input id="siteName" name="siteName" defaultValue={s.siteName} />
            </Field>
            <Field label="Tagline" htmlFor="tagline">
              <Input id="tagline" name="tagline" defaultValue={s.tagline} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Logo URL" htmlFor="logoUrl">
              <Input id="logoUrl" name="logoUrl" defaultValue={s.logoUrl ?? ""} />
            </Field>
            <Field label="Default OG image URL" htmlFor="defaultOgImageUrl">
              <Input id="defaultOgImageUrl" name="defaultOgImageUrl" defaultValue={s.defaultOgImageUrl ?? ""} />
            </Field>
          </div>
          <Field label="Contact email" htmlFor="contactEmail">
            <Input id="contactEmail" name="contactEmail" type="email" defaultValue={s.contactEmail ?? ""} />
          </Field>
          <Checkbox label="Show the trending ticker in the utility bar" name="tickerEnabled" defaultChecked={s.tickerEnabled} />
        </Card>

        <Card className="space-y-4">
          <h2 className="font-bold">Social links</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Facebook" htmlFor="facebookUrl">
              <Input id="facebookUrl" name="facebookUrl" defaultValue={s.facebookUrl ?? ""} />
            </Field>
            <Field label="X (Twitter)" htmlFor="xUrl">
              <Input id="xUrl" name="xUrl" defaultValue={s.xUrl ?? ""} />
            </Field>
            <Field label="Instagram" htmlFor="instagramUrl">
              <Input id="instagramUrl" name="instagramUrl" defaultValue={s.instagramUrl ?? ""} />
            </Field>
            <Field label="YouTube" htmlFor="youtubeUrl">
              <Input id="youtubeUrl" name="youtubeUrl" defaultValue={s.youtubeUrl ?? ""} />
            </Field>
            <Field label="TikTok" htmlFor="tiktokUrl">
              <Input id="tiktokUrl" name="tiktokUrl" defaultValue={s.tiktokUrl ?? ""} />
            </Field>
          </div>
        </Card>

        <Button type="submit">Save settings</Button>
      </form>
    </div>
  );
}
