import { requireUser } from "@/lib/require-admin";
import { PageHeader, Card } from "@/components/admin/ui";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function AccountPage() {
  const user = await requireUser();

  return (
    <div>
      <PageHeader title="My Account" />
      <Card className="mb-6 max-w-sm">
        <p className="text-sm">
          <span className="font-semibold">{user.name}</span>
          <br />
          <span className="text-muted">{user.email}</span>
          <br />
          <span className="text-muted">{user.role}</span>
        </p>
      </Card>
      <Card className="max-w-sm">
        <h2 className="mb-4 font-bold">Change password</h2>
        <ChangePasswordForm />
      </Card>
    </div>
  );
}
