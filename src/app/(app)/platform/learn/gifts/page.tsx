import { redirect } from "next/navigation";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";
import { PlatformLearnGiftsClient } from "@/components/learn/PlatformLearnGiftsClient";

export const dynamic = "force-dynamic";

export default async function PlatformLearnGiftsPage() {
  const gate = await requirePlatformPermission("platform.learn.giftAccess");
  if (!gate.ok) redirect("/platform/learn");

  return <PlatformLearnGiftsClient />;
}
