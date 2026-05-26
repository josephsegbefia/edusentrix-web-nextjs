import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { AdminLearnActivityClient } from "@/components/learn/AdminLearnActivityClient";

export const dynamic = "force-dynamic";

export default async function AdminLearnActivityPage() {
  await requireSchoolAdmin();
  return <AdminLearnActivityClient />;
}
