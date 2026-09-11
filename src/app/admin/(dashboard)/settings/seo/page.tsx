import { siteSettingsService } from "@/services/site-settings.service";
import { PageHeader, Field, Input, Textarea, Checkbox, Card, Button } from "@/components/admin/ui";
import { updateSeoSettings } from "@/app/actions/admin-settings";

export default async function SeoSettingsPage() {
  const s = await siteSettingsService.getSeoSettings();

  return (
    <div>
      <PageHeader title="SEO Settings" description="Site-wide defaults, verification codes and indexing switches." />
      <form action={updateSeoSettings} className="max-w-2xl space-y-6">
        <Card className="space-y-4">
          <Field label="Default title" htmlFor="defaultTitle" hint="Used on the homepage and as a fallback.">
            <Input id="defaultTitle" name="defaultTitle" defaultValue={s.defaultTitle} />
          </Field>
          <Field label="Title template" htmlFor="titleTemplate" hint="%s is replaced by the page title.">
            <Input id="titleTemplate" name="titleTemplate" defaultValue={s.titleTemplate} />
          </Field>
          <Field label="Default meta description" htmlFor="defaultMetaDescription">
            <Textarea id="defaultMetaDescription" name="defaultMetaDescription" rows={2} defaultValue={s.defaultMetaDescription} />
          </Field>
          <Checkbox label="Index the site by default" name="defaultRobotsIndex" defaultChecked={s.defaultRobotsIndex} />
        </Card>

        <Card className="space-y-4">
          <h2 className="font-bold">Organization</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Organization name" htmlFor="organizationName">
              <Input id="organizationName" name="organizationName" defaultValue={s.organizationName} />
            </Field>
            <Field label="Organization logo URL" htmlFor="organizationLogoUrl">
              <Input id="organizationLogoUrl" name="organizationLogoUrl" defaultValue={s.organizationLogoUrl ?? ""} />
            </Field>
          </div>
          <Field label="X / Twitter handle" htmlFor="twitterHandle" hint="e.g. @viraltrendly">
            <Input id="twitterHandle" name="twitterHandle" defaultValue={s.twitterHandle ?? ""} />
          </Field>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-bold">Search Console verification</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Google site verification" htmlFor="googleSiteVerification">
              <Input id="googleSiteVerification" name="googleSiteVerification" defaultValue={s.googleSiteVerification ?? ""} />
            </Field>
            <Field label="Bing site verification" htmlFor="bingSiteVerification">
              <Input id="bingSiteVerification" name="bingSiteVerification" defaultValue={s.bingSiteVerification ?? ""} />
            </Field>
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="font-bold">Thin-page indexing</h2>
          <Checkbox label="Allow tag pages to be indexed (each tag's own robotsIndex still applies)" name="tagPagesIndexable" defaultChecked={s.tagPagesIndexable} />
          <Checkbox label="Allow search result pages to be indexed" name="searchPagesIndexable" defaultChecked={s.searchPagesIndexable} />
        </Card>

        <Button type="submit">Save settings</Button>
      </form>
    </div>
  );
}
