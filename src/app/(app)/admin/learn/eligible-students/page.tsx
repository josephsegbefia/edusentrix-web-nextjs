import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { AdminEligibleStudentsClient } from "@/components/learn/AdminEligibleStudentsClient";

export const dynamic = "force-dynamic";

export default async function AdminLearnEligibleStudentsPage() {
  await requireSchoolAdmin();
  return <AdminEligibleStudentsClient />;
}
