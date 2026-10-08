import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { AdminLearnOverviewClient } from "@/components/learn/AdminLearnOverviewClient";
import { WorkspaceScope } from "@/components/theme/workspace-scope";

export const dynamic = "force-dynamic";

export default async function AdminLearnPage() {
  await requireSchoolAdmin();
  return (
    <WorkspaceScope>
      <AdminLearnOverviewClient />
    </WorkspaceScope>
  );
}
