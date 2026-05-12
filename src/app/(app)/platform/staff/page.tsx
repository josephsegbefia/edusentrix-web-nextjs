import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, UserCog, UserPlus, UsersRound } from "lucide-react";
import { connectToDatabase } from "@/db/connectToDatabase";
import { hasPlatformPermission } from "@/lib/platform/auth/has-platform-permission";
import { requirePlatformUser } from "@/lib/platform/auth/require-platform-user";
import { PLATFORM_ROLE_PRESETS, type PlatformStaffRolePreset } from "@/lib/platform/permissions/presets";
import { PlatformStaffProfile } from "@/models/PlatformStaffProfile";
import {
  PlatformMetricCard,
  PlatformMetricGrid,
  PlatformPageHeader,
  PlatformPill,
  PlatformSection,
  formatTimestamp,
} from "@/components/platform/platform-page-primitives";

export const dynamic = "force-dynamic";

type StaffProfileRow = {
  _id: unknown;
  email: string;
  fullName: string;
  jobTitle: string;
  rolePreset: PlatformStaffRolePreset;
  permissions?: string[];
  status: "invited" | "active" | "suspended";
  accessMode: "all_schools" | "delegated_only";
  createdAt: Date;
  updatedAt: Date;
};

const STATUS_TONES: Record<StaffProfileRow["status"], "emerald" | "amber" | "rose"> = {
  active: "emerald",
  invited: "amber",
  suspended: "rose",
};

const ACCESS_MODE_LABELS: Record<StaffProfileRow["accessMode"], string> = {
  all_schools: "All schools",
  delegated_only: "Delegated only",
};

export default async function PlatformStaffPage() {
  const auth = await requirePlatformUser();
  if (!auth.ok) {
    redirect("/dashboard");
  }

  if (!hasPlatformPermission(auth.actor, "platform.staff.read")) {
    redirect("/platform");
  }

  await connectToDatabase();

  const [staff, activeCount, invitedCount, suspendedCount] = await Promise.all([
    PlatformStaffProfile.find({})
      .sort({ status: 1, fullName: 1, createdAt: -1 })
      .limit(100)
      .lean<StaffProfileRow[]>(),
    PlatformStaffProfile.countDocuments({ status: "active" }),
    PlatformStaffProfile.countDocuments({ status: "invited" }),
    PlatformStaffProfile.countDocuments({ status: "suspended" }),
  ]);

  const totalPermissions = staff.reduce(
    (sum, profile) => sum + (profile.permissions?.length || 0),
    0
  );
  const averagePermissionCount =
    staff.length > 0 ? Math.round(totalPermissions / staff.length) : 0;
  const delegatedCount = staff.filter(
    (profile) => profile.accessMode === "delegated_only"
  ).length;

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader
        eyebrow="Platform Operations"
        title="EduSentrix staff console"
        description="Manage internal operators, their role presets, access mode, and permission posture without giving everyone full platform admin power."
        actions={
          hasPlatformPermission(auth.actor, "platform.staff.invite") ? (
            <Link
              href="/platform/staff/new"
              className="inline-flex items-center justify-between rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-400/15"
            >
              <span>Invite Staff</span>
              <UserPlus className="ml-3 h-4 w-4" />
            </Link>
          ) : null
        }
      />

      <PlatformMetricGrid>
        <PlatformMetricCard
          icon={UsersRound}
          label="Staff Profiles"
          value={staff.length.toLocaleString()}
          note="Internal EduSentrix operator profiles loaded."
          tone="cyan"
        />
        <PlatformMetricCard
          icon={ShieldCheck}
          label="Active"
          value={activeCount.toLocaleString()}
          note={`${invitedCount.toLocaleString()} invited and awaiting activation.`}
          tone="emerald"
        />
        <PlatformMetricCard
          icon={UserCog}
          label="Delegated"
          value={delegatedCount.toLocaleString()}
          note="Profiles scoped to assigned schools or tasks."
          tone="violet"
        />
        <PlatformMetricCard
          icon={ShieldCheck}
          label="Avg Permissions"
          value={averagePermissionCount.toLocaleString()}
          note={`${suspendedCount.toLocaleString()} suspended profiles currently blocked.`}
          tone="amber"
        />
      </PlatformMetricGrid>

      <PlatformSection
        title="Staff Profiles"
        description="Role presets stay human-readable while permission counts expose how broad each operator's access really is."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/45">
                <th className="pb-3 font-medium">Staff Member</th>
                <th className="pb-3 font-medium">Role Preset</th>
                <th className="pb-3 font-medium">Access Scope</th>
                <th className="pb-3 font-medium">Permissions</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((profile) => (
                <tr key={String(profile._id)} className="border-b border-white/5 align-top">
                  <td className="py-3 pr-4">
                    <div>
                      <Link
                        href={`/platform/staff/${String(profile._id)}`}
                        className="font-medium text-white transition-colors hover:text-cyan-200"
                      >
                        {profile.fullName}
                      </Link>
                      <p className="text-xs text-white/45">{profile.email}</p>
                      <p className="mt-1 text-xs text-white/35">{profile.jobTitle}</p>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <div>
                      <p className="text-white">
                        {PLATFORM_ROLE_PRESETS[profile.rolePreset]?.label || profile.rolePreset}
                      </p>
                      <p className="mt-1 max-w-xs text-xs text-white/40">
                        {PLATFORM_ROLE_PRESETS[profile.rolePreset]?.description ||
                          "Custom permission set."}
                      </p>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <PlatformPill tone={profile.accessMode === "all_schools" ? "cyan" : "violet"}>
                      {ACCESS_MODE_LABELS[profile.accessMode]}
                    </PlatformPill>
                  </td>
                  <td className="py-3 pr-4 text-white">
                    {(profile.permissions?.length || 0).toLocaleString()}
                  </td>
                  <td className="py-3 pr-4">
                    <PlatformPill tone={STATUS_TONES[profile.status]}>
                      {profile.status === "active"
                        ? "Active"
                        : profile.status === "invited"
                          ? "Invited"
                          : "Suspended"}
                    </PlatformPill>
                  </td>
                  <td className="py-3 text-white/55">{formatTimestamp(profile.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {staff.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-white/45">
              No platform staff profiles have been created yet.
            </div>
          ) : null}
        </div>
      </PlatformSection>
    </div>
  );
}
