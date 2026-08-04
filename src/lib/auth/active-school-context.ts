import "server-only";

import { cookies } from "next/headers";
import { auth, clerkClient } from "@clerk/nextjs/server";
import mongoose, { type Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School } from "@/models/School";
import { UserMembership, type IUserMembership } from "@/models/UserMembership";
import type { MembershipRole } from "@/lib/roles";
import { ensureActiveSchoolForTenant } from "@/lib/auth/ensureActiveSchoolForTenant";
import { getActiveAssistedAccessSession } from "@/lib/platform/assisted-access/session";
import { isDemoMode } from "@/lib/demo/runtime";
import { resolveDemoSessionFromCookie } from "@/lib/demo/session";
import { resolveDemoPersona } from "@/lib/demo/persona";
import { ensureCanonicalUserForClerkSession } from "@/lib/auth/canonical-user";
import { homePathForMembershipRoles } from "@/lib/auth/membership-home";
import { schoolIdFromClerkMetadata } from "@/lib/auth/resolveTenantUserForClerkSession";
import { syncClerkNameFromAppUser } from "@/lib/auth/sync-clerk-name";

export const ACTIVE_SCHOOL_COOKIE = "edusentrix_active_school";

export type ActiveSchoolMembershipSummary = {
  membershipId: string;
  schoolId: string;
  schoolName: string;
  roles: MembershipRole[];
  status: IUserMembership["status"];
  homePath: string;
};

export type ActiveSchoolContext = {
  userId: Types.ObjectId;
  schoolId: Types.ObjectId;
  membershipId: Types.ObjectId | null;
  roles: MembershipRole[];
  subroles: string[];
  membershipStatus: IUserMembership["status"];
  schoolName: string;
  homePath: string;
  source: "assisted_access" | "demo" | "cookie" | "clerk_metadata" | "single_membership";
  memberships: ActiveSchoolMembershipSummary[];
};

export type ResolveActiveSchoolResult =
  | {
      ok: true;
      context: ActiveSchoolContext;
    }
  | {
      ok: false;
      reason:
        | "unauthorized"
        | "no_profile"
        | "no_memberships"
        | "needs_school_selection"
        | "membership_suspended"
        | "school_suspended";
      userId?: string;
      memberships?: ActiveSchoolMembershipSummary[];
    };

export type ResolveActiveSchoolOptions = {
  clerkUserId?: string | null;
  selectedSchoolId?: string | null;
};

export function activeSchoolCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

export async function readActiveSchoolCookie(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(ACTIVE_SCHOOL_COOKIE)?.value;
  return value && mongoose.Types.ObjectId.isValid(value) ? value : null;
}

export async function setActiveSchoolCookie(schoolId: string): Promise<void> {
  const jar = await cookies();
  jar.set(ACTIVE_SCHOOL_COOKIE, schoolId, activeSchoolCookieOptions());
}

export async function clearActiveSchoolCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(ACTIVE_SCHOOL_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function membershipToSummary(input: {
  membership: Pick<IUserMembership, "_id" | "schoolId" | "roles" | "status">;
  schoolName: string;
}): ActiveSchoolMembershipSummary {
  const roles = (input.membership.roles || []) as MembershipRole[];
  return {
    membershipId: String(input.membership._id),
    schoolId: String(input.membership.schoolId),
    schoolName: input.schoolName,
    roles,
    status: input.membership.status,
    homePath: homePathForMembershipRoles(roles),
  };
}

async function loadMembershipSummaries(userId: Types.ObjectId) {
  const memberships = await UserMembership.find({ userId })
    .select("_id schoolId roles subroles status")
    .sort({ createdAt: 1 })
    .lean<Array<IUserMembership>>();
  const schoolIds = memberships.map((membership) => membership.schoolId);
  const schools = schoolIds.length
    ? await School.find({ _id: { $in: schoolIds } })
        .select("name status")
        .lean<Array<{ _id: Types.ObjectId; name?: string | null; status?: string | null }>>()
    : [];
  const schoolMap = new Map(schools.map((school) => [String(school._id), school]));

  return memberships.map((membership) => {
    const school = schoolMap.get(String(membership.schoolId));
    return {
      membership,
      school,
      summary: membershipToSummary({
        membership,
        schoolName: school?.name || "Unnamed School",
      }),
    };
  });
}

function buildContext(input: {
  userId: Types.ObjectId;
  row: Awaited<ReturnType<typeof loadMembershipSummaries>>[number];
  source: ActiveSchoolContext["source"];
  memberships: ActiveSchoolMembershipSummary[];
}): ActiveSchoolContext {
  const roles = (input.row.membership.roles || []) as MembershipRole[];
  return {
    userId: input.userId,
    schoolId: input.row.membership.schoolId,
    membershipId: input.row.membership._id,
    roles,
    subroles: input.row.membership.subroles || [],
    membershipStatus: input.row.membership.status,
    schoolName: input.row.school?.name || "Unnamed School",
    homePath: homePathForMembershipRoles(roles),
    source: input.source,
    memberships: input.memberships,
  };
}

export async function resolveActiveSchoolContext(
  options: ResolveActiveSchoolOptions = {}
): Promise<ResolveActiveSchoolResult> {
  const assisted = await getActiveAssistedAccessSession();
  if (assisted) {
    await ensureActiveSchoolForTenant(assisted.schoolId, { mode: "api" });
    return {
      ok: true,
      context: {
        userId: assisted.actorUserId,
        schoolId: assisted.schoolId,
        membershipId: null,
        roles: ["school_admin"],
        subroles: [],
        membershipStatus: "active",
        schoolName: assisted.schoolName,
        homePath: "/admin",
        source: "assisted_access",
        memberships: [],
      },
    };
  }

  if (isDemoMode()) {
    const session = await resolveDemoSessionFromCookie();
    if (session) {
      const persona = await resolveDemoPersona(session);
      if (persona?.schoolId && mongoose.Types.ObjectId.isValid(persona.schoolId)) {
        const schoolId = new mongoose.Types.ObjectId(persona.schoolId);
        await ensureActiveSchoolForTenant(schoolId, { mode: "api" });
        const roles = persona.role ? ([persona.role] as MembershipRole[]) : [];
        return {
          ok: true,
          context: {
            userId: new mongoose.Types.ObjectId(persona._id),
            schoolId,
            membershipId: null,
            roles,
            subroles: [],
            membershipStatus: "active",
            schoolName: "Demo school",
            homePath: homePathForMembershipRoles(roles),
            source: "demo",
            memberships: [],
          },
        };
      }
    }
  }

  const authResult = options.clerkUserId ? null : await auth();
  const clerkUserId = options.clerkUserId ?? authResult?.userId ?? null;
  if (!clerkUserId) return { ok: false, reason: "unauthorized" };

  const clerk = await clerkClient();
  const cUser = await clerk.users.getUser(clerkUserId);
  const email =
    cUser.primaryEmailAddress?.emailAddress?.toLowerCase() ||
    cUser.emailAddresses?.[0]?.emailAddress?.toLowerCase() ||
    "";

  await connectToDatabase();

  const user = await ensureCanonicalUserForClerkSession({
    clerkUserId,
    email,
    firstName: cUser.firstName,
    lastName: cUser.lastName,
    avatarUrl: cUser.imageUrl,
    role:
      (cUser.publicMetadata?.role as string | undefined) ||
      (cUser.privateMetadata?.role as string | undefined),
    schoolId: schoolIdFromClerkMetadata(cUser),
  });

  try {
    await syncClerkNameFromAppUser({
      clerkUserId,
      currentClerkFirstName: cUser.firstName,
      currentClerkLastName: cUser.lastName,
      appFirstName: user.firstName,
      appLastName: user.lastName,
      appDisplayName: user.name,
    });
  } catch (error) {
    console.error("Failed to sync Clerk name from active school context:", error);
  }

  if (!user?._id) return { ok: false, reason: "no_profile" };
  const userId =
    user._id instanceof mongoose.Types.ObjectId
      ? user._id
      : new mongoose.Types.ObjectId(String(user._id));

  const rows = await loadMembershipSummaries(userId);
  const activeRows = rows.filter((row) => row.membership.status === "active");
  const memberships = rows.map((row) => row.summary);
  const activeMemberships = activeRows.map((row) => row.summary);

  if (activeRows.length === 0) {
    return {
      ok: false,
      reason: memberships.length > 0 ? "membership_suspended" : "no_memberships",
      userId: String(userId),
      memberships,
    };
  }

  const selectedSchoolId =
    options.selectedSchoolId === undefined
      ? await readActiveSchoolCookie()
      : options.selectedSchoolId;
  if (selectedSchoolId) {
    const selected = activeRows.find(
      (row) => String(row.membership.schoolId) === selectedSchoolId
    );
    if (selected) {
      await ensureActiveSchoolForTenant(selected.membership.schoolId, { mode: "api" });
      return {
        ok: true,
        context: buildContext({
          userId,
          row: selected,
          source: "cookie",
          memberships: activeMemberships,
        }),
      };
    }
  }

  const metadataSchoolId = schoolIdFromClerkMetadata(cUser);
  if (metadataSchoolId) {
    const selected = activeRows.find(
      (row) => String(row.membership.schoolId) === metadataSchoolId
    );
    if (selected) {
      await ensureActiveSchoolForTenant(selected.membership.schoolId, { mode: "api" });
      return {
        ok: true,
        context: buildContext({
          userId,
          row: selected,
          source: "clerk_metadata",
          memberships: activeMemberships,
        }),
      };
    }
  }

  if (activeRows.length === 1) {
    const selected = activeRows[0];
    await ensureActiveSchoolForTenant(selected.membership.schoolId, { mode: "api" });
    return {
      ok: true,
      context: buildContext({
        userId,
        row: selected,
        source: "single_membership",
        memberships: activeMemberships,
      }),
    };
  }

  return {
    ok: false,
    reason: "needs_school_selection",
    userId: String(userId),
    memberships: activeMemberships,
  };
}
