import { redirect } from "next/navigation";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { PlatformLearnSchoolsClient } from "@/components/learn/PlatformLearnSchoolsClient";

export const dynamic = "force-dynamic";

export default async function PlatformLearnSchoolsPage() {
  const gate = await requirePlatformPermission("platform.learn.read");
  if (!gate.ok) redirect("/platform/learn");

  return <PlatformLearnSchoolsClient />;
}
