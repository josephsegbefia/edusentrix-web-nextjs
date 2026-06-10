// src/lib/auth/requireAdmissionsManager.ts
// Auth helper for the Admissions feature.
// Allows: school_admin (always) OR active `Delegation` with module `admissions`.
//
// See docs/DELEGATIONS_FEATURE_SPEC.md §3 (subroles are not used for access).

import { connectToDatabase } from "@/db/connectToDatabase";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import {
  findActiveDelegationsForUser,
  findActiveDelegationIdForAnyPermission,
  isDelegationActive,
} from "@/lib/delegations/service";
import { resolveActiveSchoolContext } from "@/lib/auth/active-school-context";

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
  const active = await resolveActiveSchoolContext();
  if (!active.ok) {
    if (active.reason === "needs_school_selection") {
      throw NextResponse.json({ error: "School selection required" }, { status: 409 });
    }
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const roles = active.context.roles as string[];
  const subroles = active.context.subroles;

  const isAdmin = roles.includes("school_admin");

  const schoolIdObj = active.context.schoolId;
  const userIdObj = active.context.userId;

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
