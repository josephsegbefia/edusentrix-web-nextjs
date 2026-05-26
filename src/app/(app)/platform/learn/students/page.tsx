import { redirect } from "next/navigation";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { PlatformLearnStudentsClient } from "@/components/learn/PlatformLearnStudentsClient";

export const dynamic = "force-dynamic";

export default async function PlatformLearnStudentsPage() {
  const gate = await requirePlatformPermission("platform.learn.read");
  if (!gate.ok) redirect("/platform/learn");

  return <PlatformLearnStudentsClient />;
}
