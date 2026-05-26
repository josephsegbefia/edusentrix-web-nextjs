import { redirect } from "next/navigation";
import { PlatformLearnSettingsClient } from "@/components/learn/PlatformLearnSettingsClient";
import {
  getOrCreateLearnPlatformSettings,
  serializeLearnPlatformSettings,
} from "@/lib/learn/platform-settings";
import { hasPlatformPermission } from "@/lib/platform/auth/has-platform-permission";
import { requirePlatformPermission } from "@/lib/platform/auth/require-platform-permission";

export const dynamic = "force-dynamic";

export default async function PlatformLearnSettingsPage() {
  const gate = await requirePlatformPermission("platform.learn.read");
  if (!gate.ok) redirect("/platform");

  const settings = await getOrCreateLearnPlatformSettings(gate.actor.userId);

  return (
    <PlatformLearnSettingsClient
      initialSettings={serializeLearnPlatformSettings(settings)}
      canManagePricing={hasPlatformPermission(
        gate.actor,
        "platform.learn.pricing.manage"
      )}
    />
  );
}
