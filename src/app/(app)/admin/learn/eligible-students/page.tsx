import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { AdminEligibleStudentsClient } from "@/components/learn/AdminEligibleStudentsClient";
import { WorkspaceScope } from "@/components/theme/workspace-scope";

export const dynamic = "force-dynamic";

export default async function AdminLearnEligibleStudentsPage() {
  await requireSchoolAdmin();
  return (
    <WorkspaceScope>
      <AdminEligibleStudentsClient />
    </WorkspaceScope>
  );
}
