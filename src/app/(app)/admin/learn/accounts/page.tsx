import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { AdminLearnAccountsClient } from "@/components/learn/AdminLearnAccountsClient";

export const dynamic = "force-dynamic";

export default async function AdminLearnAccountsPage() {
  await requireSchoolAdmin();
  return <AdminLearnAccountsClient />;
}
