import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { AdminLearnAccountsClient } from "@/components/learn/AdminLearnAccountsClient";
import { WorkspaceScope } from "@/components/theme/workspace-scope";

export const dynamic = "force-dynamic";

export default async function AdminLearnAccountsPage() {
  await requireSchoolAdmin();
  return (
    <WorkspaceScope>
      <AdminLearnAccountsClient />
    </WorkspaceScope>
  );
}
