import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PlatformDelegationsConsole } from "@/components/platform/delegations/PlatformDelegationsConsole";
import {
  PlatformMetricCard,
  PlatformMetricGrid,
  PlatformPageHeader,
} from "@/components/platform/platform-page-primitives";
import { hasPlatformPermission } from "@/lib/platform/auth/has-platform-permission";
import { requirePlatformUser } from "@/lib/platform/auth/require-platform-user";
import { serializePlatformDelegation } from "@/lib/platform/delegations/serialize-platform-delegation";
import { isPlatformPermissionKey } from "@/lib/platform/permissions/registry";
import { PlatformDelegation } from "@/models/PlatformDelegation";
import { PlatformStaffProfile } from "@/models/PlatformStaffProfile";
import { School } from "@/models/School";

export const dynamic = "force-dynamic";

export default async function PlatformDelegationsPage() {
  const auth = await requirePlatformUser();
  if (!auth.ok) {
    redirect("/dashboard");
  }

  if (!hasPlatformPermission(auth.actor, "platform.implementation.assignTasks")) {
    redirect("/platform");
  }

  await connectToDatabase();

  const [delegations, staffProfiles, schools, activeCount, revokedCount] = await Promise.all([
    PlatformDelegation.find({})
      .sort({ status: 1, startsAt: -1, createdAt: -1 })
      .limit(200)
      .lean(),
    PlatformStaffProfile.find({ status: { $ne: "suspended" } })
      .select("fullName email permissions")
      .sort({ fullName: 1 })
      .lean<Array<{ _id: unknown; fullName: string; email: string; permissions?: string[] }>>(),
    School.find({}).select("name").sort({ name: 1 }).lean<Array<{ _id: unknown; name?: string }>>(),
    PlatformDelegation.countDocuments({ status: "active" }),
    PlatformDelegation.countDocuments({ status: "revoked" }),
  ]);

  const schoolMap = new Map(schools.map((school) => [String(school._id), school.name || "Unnamed School"]));
  const staffMap = new Map(
    staffProfiles.map((profile) => [
      String(profile._id),
      { staffName: profile.fullName, staffEmail: profile.email },
    ])
  );

  const serializedDelegations = delegations.map((delegation) => {
    const staffLookup = delegation.staffProfileId
      ? staffMap.get(String(delegation.staffProfileId))
      : null;
    return serializePlatformDelegation(delegation, {
      schoolName: delegation.schoolId ? schoolMap.get(String(delegation.schoolId)) : null,
      staffName: staffLookup?.staffName || "Unknown staff",
      staffEmail: staffLookup?.staffEmail || "",
    });
  });

  const staffOptions = staffProfiles.map((profile) => ({
    id: String(profile._id),
    fullName: profile.fullName,
    email: profile.email,
    permissions: (profile.permissions || []).filter(isPlatformPermissionKey),
  }));

  const schoolOptions = schools.map((school) => ({
    id: String(school._id),
    name: school.name || "Unnamed School",
  }));

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader
        eyebrow="Platform Operations"
        title="Delegations"
        description="Assign scoped school work to EduSentrix staff without turning delegated operators into full platform admins."
      />

      <PlatformMetricGrid>
        <PlatformMetricCard
          icon={ClipboardList}
          label="Delegations"
          value={delegations.length.toLocaleString()}
          note="Total delegation records loaded."
          tone="cyan"
        />
        <PlatformMetricCard
          icon={ClipboardList}
          label="Active"
          value={activeCount.toLocaleString()}
          note="Currently usable delegated access windows."
          tone="emerald"
        />
        <PlatformMetricCard
          icon={ClipboardList}
          label="Revoked"
          value={revokedCount.toLocaleString()}
          note="Closed delegations kept for audit history."
          tone="rose"
        />
        <PlatformMetricCard
          icon={ClipboardList}
          label="Assignable Staff"
          value={staffOptions.length.toLocaleString()}
          note="Non-suspended platform staff profiles."
          tone="violet"
        />
      </PlatformMetricGrid>

      <PlatformDelegationsConsole
        delegations={serializedDelegations}
        staffOptions={staffOptions}
        schoolOptions={schoolOptions}
      />
    </div>
  );
}
