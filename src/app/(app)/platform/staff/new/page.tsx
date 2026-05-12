import { redirect } from "next/navigation";
import { PlatformPageHeader, PlatformSection } from "@/components/platform/platform-page-primitives";
import { PlatformStaffInviteWizard } from "@/components/platform/staff/PlatformStaffInviteWizard";
import { hasPlatformPermission } from "@/lib/platform/auth/has-platform-permission";
import { requirePlatformUser } from "@/lib/platform/auth/require-platform-user";

export const dynamic = "force-dynamic";

export default async function NewPlatformStaffPage() {
  const auth = await requirePlatformUser();
  if (!auth.ok) {
    redirect("/dashboard");
  }

  if (!hasPlatformPermission(auth.actor, "platform.staff.invite")) {
    redirect("/platform/staff");
  }

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader
        eyebrow="EduSentrix Staff"
        title="Invite platform staff"
        description="Create an internal operator profile with a clear role preset, permission set, and access scope before the invitation is sent."
      />

      <PlatformSection
        title="Invite Wizard"
        description="Use presets for common jobs, then review sensitive permissions before sending the invitation."
      >
        <PlatformStaffInviteWizard
          actorPermissions={auth.actor.permissions}
          isLegacyPlatformAdmin={auth.actor.isLegacyPlatformAdmin}
        />
      </PlatformSection>
    </div>
  );
}
