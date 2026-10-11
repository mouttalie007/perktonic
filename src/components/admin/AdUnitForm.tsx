import type { AdUnit } from "@prisma/client";
import { TitleSlugFields } from "./TitleSlugFields";
import { Field, Textarea, Select, Checkbox, Input, Card, Button, LinkButton } from "./ui";

export function AdUnitForm({
  unit,
  action,
}: {
  unit?: AdUnit;
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action} className="max-w-2xl space-y-6">
      {unit && <input type="hidden" name="id" value={unit.id} />}
      <Card className="space-y-4">
        <TitleSlugFields titleLabel="Name" titleName="name" slugName="key" defaultTitle={unit?.name} defaultSlug={unit?.key} />
        <Field label="Ad code" htmlFor="code" hint="Paste the full snippet from AdSense (or another network) — used as-is.">
          <Textarea id="code" name="code" rows={6} required defaultValue={unit?.code ?? ""} className="font-mono text-xs" />
        </Field>
        <Field label="Format" htmlFor="format">
          <Select id="format" name="format" defaultValue={unit?.format ?? "auto"}>
            <option value="auto">Auto</option>
            <option value="horizontal">Horizontal</option>
            <option value="rectangle">Rectangle</option>
            <option value="vertical">Vertical</option>
          </Select>
        </Field>
        <Checkbox label="Enabled" name="enabled" defaultChecked={unit?.enabled ?? true} />
      </Card>

      <Card className="space-y-4">
        <h2 className="font-bold">Device visibility &amp; reserved space</h2>
        <div className="flex gap-6">
          <Checkbox label="Desktop" name="showDesktop" defaultChecked={unit?.showDesktop ?? true} />
          <Checkbox label="Tablet" name="showTablet" defaultChecked={unit?.showTablet ?? true} />
          <Checkbox label="Mobile" name="showMobile" defaultChecked={unit?.showMobile ?? true} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reserved height — desktop (px)" htmlFor="reservedHeightDesktop" hint="Prevents layout shift while the ad loads.">
            <Input id="reservedHeightDesktop" name="reservedHeightDesktop" type="number" defaultValue={unit?.reservedHeightDesktop ?? ""} />
          </Field>
          <Field label="Reserved height — mobile (px)" htmlFor="reservedHeightMobile">
            <Input id="reservedHeightMobile" name="reservedHeightMobile" type="number" defaultValue={unit?.reservedHeightMobile ?? ""} />
          </Field>
        </div>
      </Card>

      <div className="flex gap-2">
        <Button type="submit">{unit ? "Save changes" : "Create ad unit"}</Button>
        <LinkButton href="/adminiyad/ads/units">Cancel</LinkButton>
      </div>
    </form>
  );
}
