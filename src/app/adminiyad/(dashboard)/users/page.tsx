import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-admin";
import { PageHeader, Card, Field, Input, Select, Badge, Button, EmptyRow } from "@/components/admin/ui";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { createUser, deleteUser, setUserActive } from "@/app/actions/admin-users";

export default async function UsersPage() {
  const me = await requireUser("ADMIN");
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div>
        <PageHeader title="Users" description="Admin dashboard accounts." />
        <div className="border-line overflow-x-auto rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-muted text-xs font-bold tracking-wide uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {users.length === 0 && <EmptyRow colSpan={5}>No users.</EmptyRow>}
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-semibold">
                    {u.name} {u.id === me.id && <span className="text-muted font-normal">(you)</span>}
                  </td>
                  <td className="text-muted px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge>{u.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.isActive ? "success" : "danger"}>{u.isActive ? "Active" : "Disabled"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== me.id && (
                      <div className="flex items-center justify-end gap-3">
                        <form action={setUserActive}>
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="isActive" value={u.isActive ? "" : "on"} />
                          <button type="submit" className="text-accent-blue text-xs font-bold hover:underline">
                            {u.isActive ? "Disable" : "Enable"}
                          </button>
                        </form>
                        <form action={deleteUser}>
                          <input type="hidden" name="id" value={u.id} />
                          <DeleteButton />
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Card className="h-fit space-y-4">
        <h2 className="font-bold">New user</h2>
        <form action={createUser} className="space-y-3">
          <Field label="Name" htmlFor="name">
            <Input id="name" name="name" required />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" required />
          </Field>
          <Field label="Role" htmlFor="role">
            <Select id="role" name="role" defaultValue="AUTHOR">
              <option value="AUTHOR">Author</option>
              <option value="EDITOR">Editor</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </Field>
          <Field label="Temporary password" htmlFor="password" hint="At least 8 characters. Share it securely.">
            <Input id="password" name="password" type="text" required minLength={8} />
          </Field>
          <Button type="submit" className="w-full justify-center">
            Create user
          </Button>
        </form>
      </Card>
    </div>
  );
}
