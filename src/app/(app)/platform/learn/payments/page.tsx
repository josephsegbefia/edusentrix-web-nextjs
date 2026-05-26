import { redirect } from "next/navigation";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { PlatformLearnPaymentsClient } from "@/components/learn/PlatformLearnPaymentsClient";

export const dynamic = "force-dynamic";

export default async function PlatformLearnPaymentsPage() {
  const gate = await requirePlatformPermission("platform.learn.payments.read");
  if (!gate.ok) redirect("/platform/learn");

  return <PlatformLearnPaymentsClient />;
}
