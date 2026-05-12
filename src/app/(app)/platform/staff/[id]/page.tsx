import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import mongoose from "mongoose";
import { ArrowLeft, Mail, ShieldCheck, UserCog } from "lucide-react";
import { connectToDatabase } from "@/db/connectToDatabase";
import { PlatformPageHeader, PlatformPill, PlatformSection, formatTimestamp } from "@/components/platform/platform-page-primitives";
import { PlatformStaffProfileManager } from "@/components/platform/staff/PlatformStaffProfileManager";
import { hasPlatformPermission } from "@/lib/platform/auth/has-platform-permission";
import { requirePlatformUser } from "@/lib/platform/auth/require-platform-user";
import { PLATFORM_ROLE_PRESETS } from "@/lib/platform/permissions/presets";
import { serializePlatformStaffProfile } from "@/lib/platform/staff/serialize-platform-staff";
import { PlatformStaffProfile } from "@/models/PlatformStaffProfile";

export const dynamic = "force-dynamic";

const STATUS_TONES: Record<string, "emerald" | "amber" | "rose"> = {
  active: "emerald",
  invited: "amber",
  suspended: "rose",
};

export default async function PlatformStaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await requirePlatformUser();
  if (!auth.ok) {
    redirect("/dashboard");
  }

  if (!hasPlatformPermission(auth.actor, "platform.staff.read")) {
    redirect("/platform");
  }

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    notFound();
  }

  await connectToDatabase();
  const profileRaw = await PlatformStaffProfile.findById(id).lean();
  if (!profileRaw) {
    notFound();
  }

  const profile = serializePlatformStaffProfile(profileRaw);
  const rolePreset = PLATFORM_ROLE_PRESETS[profile.rolePreset];
  const canManageRoles = hasPlatformPermission(auth.actor, "platform.staff.manageRoles");
  const canSuspend = hasPlatformPermission(auth.actor, "platform.staff.suspend");

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader
        eyebrow="EduSentrix Staff"
        title={profile.fullName}
        description={`${profile.jobTitle} · ${rolePreset?.label || profile.rolePreset}`}
        actions={
          <Link
            href="/platform/staff"
            className="inline-flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="mr-3 h-4 w-4" />
            <span>Back to Staff</span>
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <PlatformSection title="Identity" description="Internal operator profile and invite status.">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-100">
                <UserCog className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium text-white">{profile.fullName}</p>
                <p className="text-sm text-white/45">{profile.jobTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-white/55">
              <Mail className="h-4 w-4" />
              {profile.email}
            </div>
            <PlatformPill tone={STATUS_TONES[profile.status]}>
              {profile.status === "active"
                ? "Active"
                : profile.status === "invited"
                  ? "Invited"
                  : "Suspended"}
            </PlatformPill>
          </div>
        </PlatformSection>

        <PlatformSection title="Access" description="Role preset and school scope.">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-white">{rolePreset?.label || profile.rolePreset}</p>
              <p className="mt-1 text-sm text-white/45">{rolePreset?.description || "Custom platform access."}</p>
            </div>
            <PlatformPill tone={profile.accessMode === "all_schools" ? "cyan" : "violet"}>
              {profile.accessMode === "all_schools" ? "All schools" : "Delegated only"}
            </PlatformPill>
          </div>
        </PlatformSection>

        <PlatformSection title="Audit Posture" description="Operational security snapshot.">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-violet-400/10 p-3 text-violet-100">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="font-medium text-white">{profile.permissions.length} permissions</p>
                <p className="text-sm text-white/45">Updated {formatTimestamp(profile.updatedAt)}</p>
              </div>
            </div>
            {profile.suspensionReason ? (
              <p className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-50">
                {profile.suspensionReason}
              </p>
            ) : null}
          </div>
        </PlatformSection>
      </div>

      <PlatformStaffProfileManager
        profile={profile}
        actorPermissions={auth.actor.permissions}
        isLegacyPlatformAdmin={auth.actor.isLegacyPlatformAdmin}
        canManageRoles={canManageRoles}
        canSuspend={canSuspend}
      />
    </div>
  );
}
