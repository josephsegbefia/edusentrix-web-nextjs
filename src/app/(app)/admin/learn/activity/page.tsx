import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { AdminLearnActivityClient } from "@/components/learn/AdminLearnActivityClient";
import { WorkspaceScope } from "@/components/theme/workspace-scope";

export const dynamic = "force-dynamic";

export default async function AdminLearnActivityPage() {
  await requireSchoolAdmin();
  return (
    <WorkspaceScope>
      <AdminLearnActivityClient />
    </WorkspaceScope>
  );
}
