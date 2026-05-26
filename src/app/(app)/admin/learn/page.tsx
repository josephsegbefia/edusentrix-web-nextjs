import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { AdminLearnOverviewClient } from "@/components/learn/AdminLearnOverviewClient";

export const dynamic = "force-dynamic";

export default async function AdminLearnPage() {
  await requireSchoolAdmin();
  return <AdminLearnOverviewClient />;
}
