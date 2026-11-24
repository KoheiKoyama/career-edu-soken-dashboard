import { redirect } from "next/navigation";
import { createAccount } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { AccountFields } from "@/components/forms";
import { Card } from "@/components/ui";
import { listUsers } from "@/lib/queries";
import { canEdit, requireUser } from "@/lib/session";

export default async function NewAccountPage() {
  const me = await requireUser();
  if (!canEdit(me)) redirect("/");
  const users = await listUsers();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">アカウントを追加</h1>
      <Card>
        <ActionForm action={createAccount}>
          <AccountFields users={users} me={me} />
        </ActionForm>
      </Card>
    </div>
  );
}
