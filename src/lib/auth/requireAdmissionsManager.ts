// src/lib/auth/requireAdmissionsManager.ts
// Auth helper for the Admissions feature.
// Allows: school_admin (always) OR active `Delegation` with module `admissions`.
//
// See docs/DELEGATIONS_FEATURE_SPEC.md §3 (subroles are not used for access).

import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { User, type IUser } from "@/models/User";
import { UserMembership, type IUserMembership } from "@/models/UserMembership";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { tryResolveDemoGuard } from "@/lib/demo/guard-integration";
import {
  findActiveDelegationsForUser,
  findActiveDelegationIdForAnyPermission,
  isDelegationActive,
} from "@/lib/delegations/service";
import { ensureActiveSchoolForTenant } from "@/lib/auth/ensureActiveSchoolForTenant";
import { getActiveAssistedAccessSession } from "@/lib/platform/assisted-access/session";

export interface AdmissionsManagerContext {
  userId: Types.ObjectId;
  schoolId: Types.ObjectId;
  roles: string[];
  /** Membership subroles (informational only; not used for admissions authorization). */
  subroles: string[];
  isAdmin: boolean;
  /** True when the user has admissions access via delegation but is not a school admin. */
  isDelegate: boolean;
  /** Effective admissions permission strings for non-admins (from active delegations only). */
  admissionsPermissions: string[];
  /** Active delegation document used for admissions access, when `isDelegate`. */
  activeDelegationId: Types.ObjectId | null;
}

function legacyRoleToArray(role?: string): string[] {
  if (role === "school_admin") return ["school_admin"];
  if (role === "billing_owner") return ["billing_owner"];
  if (role === "teacher") return ["teacher"];
  if (role === "parent") return ["parent"];
  if (role === "student") return ["student"];
  if (role === "bursar") return ["bursar"];
  return ["staff"];
}

function buildAdmissionsPermissionsFromDelegations(
  delegations: Awaited<ReturnType<typeof findActiveDelegationsForUser>>
): string[] {
  const permSet = new Set<string>();
  for (const d of delegations) {
    if (d.module === "admissions" && isDelegationActive(d)) {
      for (const p of d.permissions ?? []) permSet.add(p);
    }
  }
  return Array.from(permSet);
}

export async function requireAdmissionsManager(): Promise<AdmissionsManagerContext> {
  const demo = await tryResolveDemoGuard();
  if (demo.isDemo && demo.user.schoolId) {
    await connectToDatabase();
    await ensureActiveSchoolForTenant(demo.user.schoolId as Types.ObjectId, {
      mode: "api",
    });
    const roles = [...demo.membership.roles] as string[];
    const subroles = [...(demo.membership.subroles ?? [])] as string[];
    const isAdmin = roles.includes("school_admin");
    const delegations = !isAdmin
      ? await findActiveDelegationsForUser(
          demo.user.schoolId as Types.ObjectId,
          demo.user._id as Types.ObjectId
        )
      : [];
    const admissionsPermissions = !isAdmin ? buildAdmissionsPermissionsFromDelegations(delegations) : [];
    if (!isAdmin && admissionsPermissions.length === 0) {
      throw NextResponse.json({ error: "Admissions access required" }, { status: 403 });
    }
    const schoolIdDemo = demo.user.schoolId as Types.ObjectId;
    const userIdDemo = demo.user._id as Types.ObjectId;
    const activeDelegationId =
      !isAdmin && admissionsPermissions.length > 0
        ? await findActiveDelegationIdForAnyPermission({
            schoolId: schoolIdDemo,
            staffUserId: userIdDemo,
            permissions: admissionsPermissions,
          })
        : null;
    return {
      userId: userIdDemo,
      schoolId: schoolIdDemo,
      roles,
      subroles,
      isAdmin,
      isDelegate: !isAdmin && admissionsPermissions.length > 0,
      admissionsPermissions,
      activeDelegationId,
    };
  }

  const assisted = await getActiveAssistedAccessSession();
  if (assisted) {
    await ensureActiveSchoolForTenant(assisted.schoolId, { mode: "api" });
    return {
      userId: assisted.actorUserId,
      schoolId: assisted.schoolId,
      roles: ["school_admin"],
      subroles: [],
      isAdmin: true,
      isDelegate: false,
      admissionsPermissions: [],
      activeDelegationId: null,
    };
  }

  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const userRaw = await User.findOne({ clerkUserId }).lean();
  const userNormalized = Array.isArray(userRaw) ? userRaw[0] : userRaw;
  const user = userNormalized as Pick<IUser, "_id" | "schoolId" | "role"> | null;

  if (!user) {
    throw NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  if (!user.schoolId) {
    throw NextResponse.json(
      { error: "User is not associated with a school" },
      { status: 400 }
    );
  }

  let membership = (await UserMembership.findOne({
    userId: user._id,
    schoolId: user.schoolId,
  }).lean()) as IUserMembership | null;

  if (!membership) {
    const created = await UserMembership.create({
      userId: user._id,
      schoolId: user.schoolId,
      roles: legacyRoleToArray(user.role),
      status: "active",
    });
    membership = created.toObject() as IUserMembership;
  }

  if (membership.status !== "active") {
    throw NextResponse.json(
      { error: "Membership is not active" },
      { status: 403 }
    );
  }

  const roles = (membership.roles ?? []) as string[];
  const subroles = (membership.subroles ?? []) as string[];

  const isAdmin = roles.includes("school_admin");

  const schoolIdObj = user.schoolId as Types.ObjectId;
  await ensureActiveSchoolForTenant(schoolIdObj, { mode: "api" });
  const userIdObj = user._id as Types.ObjectId;

  const delegations = !isAdmin
    ? await findActiveDelegationsForUser(schoolIdObj, userIdObj)
    : [];

  const admissionsPermissions = !isAdmin ? buildAdmissionsPermissionsFromDelegations(delegations) : [];

  if (!isAdmin && admissionsPermissions.length === 0) {
    throw NextResponse.json(
      { error: "Admissions access required" },
      { status: 403 }
    );
  }

  const activeDelegationId =
    !isAdmin && admissionsPermissions.length > 0
      ? await findActiveDelegationIdForAnyPermission({
          schoolId: schoolIdObj,
          staffUserId: userIdObj,
          permissions: admissionsPermissions,
        })
      : null;

  return {
    userId: userIdObj,
    schoolId: schoolIdObj,
    roles,
    subroles,
    isAdmin,
    isDelegate: !isAdmin && admissionsPermissions.length > 0,
    admissionsPermissions,
    activeDelegationId,
  };
}
