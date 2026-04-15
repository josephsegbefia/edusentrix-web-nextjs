import Link from "next/link";
import { ArrowRight, AlertTriangle, Shield, UserPlus, Users } from "lucide-react";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import { User } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";
import {
  PlatformMetricCard,
  PlatformMetricGrid,
  PlatformPageHeader,
  PlatformPill,
  PlatformSection,
  formatDate,
  formatTimestamp,
} from "@/components/platform/platform-page-primitives";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  platform_admin: "Platform Admin",
  school_admin: "School Admin",
  billing_owner: "Billing Owner",
  bursar: "Bursar",
  staff: "Staff",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
};

const STATUS_TONES: Record<string, "emerald" | "amber" | "rose"> = {
  active: "emerald",
  invited: "amber",
  suspended: "rose",
};

function displayName(user: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
}) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return user.name?.trim() || fullName || user.email;
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

export default async function PlatformUsersPage() {
  await connectToDatabase();

  const [totalUsers, platformAdmins, pendingOnboarding, invitedMemberships, suspendedMemberships] =
    await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: "platform_admin" }),
      User.countDocuments({ pendingOnboarding: true }),
      UserMembership.countDocuments({ status: "invited" }),
      UserMembership.countDocuments({ status: "suspended" }),
    ]);

  const [recentUsers, exceptionMemberships, schoolRollup] = await Promise.all([
    User.find({})
      .sort({ createdAt: -1 })
      .limit(40)
      .select("email name firstName lastName role pendingOnboarding createdAt")
      .lean<
        Array<{
          _id: unknown;
          email: string;
          name?: string | null;
          firstName?: string | null;
          lastName?: string | null;
          role?: string | null;
          pendingOnboarding?: boolean | null;
          createdAt: Date;
        }>
      >(),
    UserMembership.find({ status: { $in: ["invited", "suspended"] } })
      .sort({ updatedAt: -1 })
      .limit(16)
      .select("userId schoolId roles status updatedAt")
      .lean<
        Array<{
          _id: unknown;
          userId: unknown;
          schoolId: unknown;
          roles?: string[];
          status: "invited" | "suspended";
          updatedAt: Date;
        }>
      >(),
    UserMembership.aggregate<{
      _id: unknown;
      users: number;
      active: number;
      invited: number;
      suspended: number;
    }>([
      {
        $group: {
          _id: "$schoolId",
          users: { $sum: 1 },
          active: {
            $sum: {
              $cond: [{ $eq: ["$status", "active"] }, 1, 0],
            },
          },
          invited: {
            $sum: {
              $cond: [{ $eq: ["$status", "invited"] }, 1, 0],
            },
          },
          suspended: {
            $sum: {
              $cond: [{ $eq: ["$status", "suspended"] }, 1, 0],
            },
          },
        },
      },
      { $sort: { users: -1, active: -1 } },
      { $limit: 10 },
    ]),
  ]);

  const recentUserIds = recentUsers.map((user) => user._id);
  const recentMemberships = recentUserIds.length
    ? await UserMembership.find({ userId: { $in: recentUserIds } })
        .select("userId schoolId roles status")
        .lean<
          Array<{
            _id: unknown;
            userId: unknown;
            schoolId: unknown;
            roles?: string[];
            status: "active" | "invited" | "suspended";
          }>
        >()
    : [];

  const exceptionUserIds = unique(exceptionMemberships.map((membership) => String(membership.userId)));
  const exceptionUsers = exceptionUserIds.length
    ? await User.find({ _id: { $in: exceptionUserIds } })
        .select("email name firstName lastName")
        .lean<
          Array<{
            _id: unknown;
            email: string;
            name?: string | null;
            firstName?: string | null;
            lastName?: string | null;
          }>
        >()
    : [];

  const schoolIds = unique([
    ...recentMemberships.map((membership) => String(membership.schoolId)),
    ...exceptionMemberships.map((membership) => String(membership.schoolId)),
    ...schoolRollup.map((row) => String(row._id)),
  ]);

  const schools = schoolIds.length
    ? await School.find({ _id: { $in: schoolIds } })
        .select("name")
        .lean<Array<{ _id: unknown; name: string }>>()
    : [];

  const schoolMap = new Map(schools.map((school) => [String(school._id), school.name]));
  const exceptionUserMap = new Map(
    exceptionUsers.map((user) => [String(user._id), displayName(user)])
  );
  const membershipsByUser = new Map<
    string,
    Array<{
      schoolId: string;
      schoolName: string;
      roles: string[];
      status: "active" | "invited" | "suspended";
    }>
  >();

  for (const membership of recentMemberships) {
    const key = String(membership.userId);
    const existing = membershipsByUser.get(key) || [];
    existing.push({
      schoolId: String(membership.schoolId),
      schoolName: schoolMap.get(String(membership.schoolId)) || "Unknown school",
      roles: membership.roles || [],
      status: membership.status,
    });
    membershipsByUser.set(key, existing);
  }

  return (
    <div className="space-y-6 p-2 md:p-4">
      <PlatformPageHeader
        eyebrow="Platform Identity"
        title="User directory and access posture"
        description="Inspect account creation, school membership coverage, onboarding backlog, and the latest access exceptions across every school."
        actions={
          <>
            <Link
              href="/platform/schools"
              className="inline-flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <span>School Portfolio</span>
              <ArrowRight className="ml-3 h-4 w-4" />
            </Link>
            <Link
              href="/platform/applications"
              className="inline-flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <span>Applications Queue</span>
              <ArrowRight className="ml-3 h-4 w-4" />
            </Link>
          </>
        }
      />

      <PlatformMetricGrid>
        <PlatformMetricCard
          icon={Users}
          label="Users"
          value={totalUsers.toLocaleString()}
          note="All user documents across platform and school roles."
          tone="cyan"
        />
        <PlatformMetricCard
          icon={Shield}
          label="Platform Admins"
          value={platformAdmins.toLocaleString()}
          note="Direct platform-level operator accounts."
          tone="violet"
        />
        <PlatformMetricCard
          icon={UserPlus}
          label="Pending Onboarding"
          value={pendingOnboarding.toLocaleString()}
          note="Users still marked as pending onboarding."
          tone="amber"
        />
        <PlatformMetricCard
          icon={AlertTriangle}
          label="Access Exceptions"
          value={(invitedMemberships + suspendedMemberships).toLocaleString()}
          note={`${invitedMemberships} invited and ${suspendedMemberships} suspended memberships.`}
          tone="rose"
        />
      </PlatformMetricGrid>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <PlatformSection
          title="Recent Directory"
          description="Latest user records with their membership footprint and access posture."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-white/45">
                  <th className="pb-3 font-medium">User</th>
                  <th className="pb-3 font-medium">Primary Role</th>
                  <th className="pb-3 font-medium">School Footprint</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((user) => {
                  const memberships = membershipsByUser.get(String(user._id)) || [];
                  const schoolNames = memberships.map((membership) => membership.schoolName);
                  const roleList = unique([
                    ...(user.role ? [user.role] : []),
                    ...memberships.flatMap((membership) => membership.roles || []),
                  ]);
                  const activeStatuses = unique(memberships.map((membership) => membership.status));
                  const userStatus = user.pendingOnboarding
                    ? { tone: "amber" as const, label: "Pending onboarding" }
                    : activeStatuses.includes("suspended")
                      ? { tone: "rose" as const, label: "Suspended access" }
                      : activeStatuses.includes("invited")
                        ? { tone: "amber" as const, label: "Invitation pending" }
                        : { tone: "emerald" as const, label: "Active" };

                  return (
                    <tr key={String(user._id)} className="border-b border-white/5 align-top">
                      <td className="py-3 pr-4">
                        <div>
                          <p className="font-medium text-white">{displayName(user)}</p>
                          <p className="text-xs text-white/45">{user.email}</p>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1.5">
                          {roleList.length > 0 ? (
                            roleList.map((role) => (
                              <PlatformPill key={role} tone={role === "platform_admin" ? "violet" : "slate"}>
                                {ROLE_LABELS[role] || role}
                              </PlatformPill>
                            ))
                          ) : (
                            <span className="text-white/35">No role recorded</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        {memberships.length > 0 ? (
                          <div>
                            <p className="text-white">
                              {memberships.length} school
                              {memberships.length === 1 ? "" : "s"}
                            </p>
                            <p className="text-xs text-white/45">
                              {schoolNames.slice(0, 2).join(", ")}
                              {schoolNames.length > 2 ? ` +${schoolNames.length - 2} more` : ""}
                            </p>
                          </div>
                        ) : (
                          <span className="text-white/35">Platform-only account</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <PlatformPill tone={userStatus.tone}>{userStatus.label}</PlatformPill>
                      </td>
                      <td className="py-3 text-white/55">{formatDate(user.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </PlatformSection>

        <PlatformSection
          title="Access Exceptions"
          description="Most recent non-active memberships that usually require ops intervention."
        >
          <div className="space-y-3">
            {exceptionMemberships.length > 0 ? (
              exceptionMemberships.map((membership) => (
                <div
                  key={String(membership._id)}
                  className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-white">
                        {exceptionUserMap.get(String(membership.userId)) || "Unknown user"}
                      </p>
                      <p className="text-xs text-white/45">
                        {schoolMap.get(String(membership.schoolId)) || "Unknown school"}
                      </p>
                    </div>
                    <PlatformPill tone={STATUS_TONES[membership.status]}>
                      {membership.status === "invited" ? "Invitation pending" : "Suspended"}
                    </PlatformPill>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/45">
                    <span>{(membership.roles || []).map((role) => ROLE_LABELS[role] || role).join(", ") || "No roles recorded"}</span>
                    <span>•</span>
                    <span>{formatTimestamp(membership.updatedAt)}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-white/45">No invited or suspended memberships right now.</p>
            )}
          </div>
        </PlatformSection>
      </div>

      <PlatformSection
        title="Schools With The Broadest Access Footprint"
        description="Membership density by school to help spot operational hotspots or bulk-invite backlogs."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/45">
                <th className="pb-3 font-medium">School</th>
                <th className="pb-3 font-medium">Members</th>
                <th className="pb-3 font-medium">Active</th>
                <th className="pb-3 font-medium">Invited</th>
                <th className="pb-3 font-medium">Suspended</th>
              </tr>
            </thead>
            <tbody>
              {schoolRollup.map((row) => (
                <tr key={String(row._id)} className="border-b border-white/5">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/platform/schools/${String(row._id)}`}
                      className="font-medium text-white transition-colors hover:text-cyan-200"
                    >
                      {schoolMap.get(String(row._id)) || "Unknown school"}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-white">{row.users.toLocaleString()}</td>
                  <td className="py-3 pr-4">
                    <PlatformPill tone="emerald">{row.active.toLocaleString()}</PlatformPill>
                  </td>
                  <td className="py-3 pr-4">
                    <PlatformPill tone="amber">{row.invited.toLocaleString()}</PlatformPill>
                  </td>
                  <td className="py-3">
                    <PlatformPill tone="rose">{row.suspended.toLocaleString()}</PlatformPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PlatformSection>
    </div>
  );
}
