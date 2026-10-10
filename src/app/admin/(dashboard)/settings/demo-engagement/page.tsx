import { siteSettingsService } from "@/services/site-settings.service";
import { PageHeader, Field, Textarea, Card, Button } from "@/components/admin/ui";
import { saveDemoCommentPool } from "@/app/actions/demo-engagement";
import { DemoEngagementActions } from "@/components/admin/DemoEngagementActions";

/**
 * Pre-launch demo engagement (perktonic workflow, 2026-10-09). Paste a pool
 * of generic comments once; newly published articles get a random subset
 * of them plus random reaction counts automatically (see the publish hook
 * in admin-articles.ts). "Apply" backfills already-published articles
 * that predate this feature; "Clear" wipes all of it before going live.
 */
export default async function DemoEngagementPage() {
  const s = await siteSettingsService.getSiteSettings();

  return (
    <div>
      <PageHeader
        title="Demo Engagement"
        description="A pool of generic comments, randomly distributed across articles so the site looks established before real traffic exists. Clear it all once before going live."
      />

      <form action={saveDemoCommentPool} className="max-w-2xl space-y-4">
        <Card className="space-y-4">
          <Field
            label="Comment pool"
            htmlFor="demoCommentPool"
            hint="One comment per line. New published articles pick a random subset automatically; the button below backfills existing ones."
          >
            <Textarea
              id="demoCommentPool"
              name="demoCommentPool"
              rows={14}
              defaultValue={s.demoCommentPool ?? ""}
              placeholder={"This actually worked, thank you!\nWish I'd found this sooner.\nDid this for my daughter's project, saved us a lot."}
              className="font-mono text-xs"
            />
          </Field>
          <Button type="submit">Save comment pool</Button>
        </Card>
      </form>

      <div className="mt-6 max-w-2xl">
        <Card className="space-y-4">
          <h2 className="font-bold">Apply / clear</h2>
          <DemoEngagementActions />
        </Card>
      </div>
    </div>
  );
}
