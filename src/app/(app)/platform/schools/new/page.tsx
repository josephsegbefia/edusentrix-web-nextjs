import { redirect } from "next/navigation";
import { PlatformPageHeader, PlatformSection } from "@/components/platform/platform-page-primitives";
import { PlatformSchoolCreateWizard } from "@/components/platform/schools/PlatformSchoolCreateWizard";
import { connectToDatabase } from "@/db/connectToDatabase";
import { hasPlatformPermission } from "@/lib/platform/auth/has-platform-permission";
import { requirePlatformUser } from "@/lib/platform/auth/require-platform-user";
import { PlatformStaffProfile } from "@/models/PlatformStaffProfile";

export const dynamic = "force-dynamic";

export default async function NewPlatformSchoolPage() {
  const auth = await requirePlatformUser();
  if (!auth.ok) redirect("/dashboard");
  if (!hasPlatformPermission(auth.actor, "platform.schools.create")) redirect("/platform/schools");

  await connectToDatabase();
  const owners = await PlatformStaffProfile.find({
    status: { $ne: "suspended" },
    permissions: "platform.implementation.manage",
  }).select("userId fullName").sort({ fullName: 1 }).lean<Array<{ _id: unknown; userId: unknown; fullName: string }>>();

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader eyebrow="Schools" title="Create school" description="Create a school directly from platform operations and open its implementation workspace." />
      <PlatformSection title="School Setup" description="Use premium selects and custom date pickers for controlled setup decisions.">
        <PlatformSchoolCreateWizard ownerOptions={owners.map((owner) => ({ id: String(owner._id), userId: String(owner.userId), name: owner.fullName }))} />
      </PlatformSection>
    </div>
  );
}
