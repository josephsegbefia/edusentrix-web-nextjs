import { redirect } from "next/navigation";
import { PlatformPageHeader, PlatformSection } from "@/components/platform/platform-page-primitives";
import { PlatformSchoolCreateWizard } from "@/components/platform/schools/PlatformSchoolCreateWizard";
import { hasPlatformPermission } from "@/lib/platform/auth/has-platform-permission";
import { requirePlatformUser } from "@/lib/platform/auth/require-platform-user";

export const dynamic = "force-dynamic";

export default async function NewPlatformSchoolPage() {
  const auth = await requirePlatformUser();
  if (!auth.ok) redirect("/dashboard");
  if (!hasPlatformPermission(auth.actor, "platform.schools.create")) redirect("/platform/schools");

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader eyebrow="Schools" title="Create school" description="Create a school tenant and primary school admin from platform operations." />
      <PlatformSection title="School Setup" description="Create the school record and initial school admin account.">
        <PlatformSchoolCreateWizard />
      </PlatformSection>
    </div>
  );
}
