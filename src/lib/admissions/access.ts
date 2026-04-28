// src/lib/admissions/access.ts
// Server-side helpers used by Admissions APIs and (lightly) by client hooks
// to check whether a user can manage admissions or has been delegated.
//
// See docs/ADMISSIONS_DEVELOPMENT_SPEC.md §4.

import { connectToDatabase } from "@/db/connectToDatabase";
import { UserMembership } from "@/models/UserMembership";
import { Teacher } from "@/models/Teacher";
import type { Types } from "mongoose";
import { findActiveDelegationsForUser, isDelegationActive } from "@/lib/delegations/service";

const ADMISSIONS_OFFICER_SUBROLE = "admissions_officer" as const;

/**
 * Legacy data helper only: writes `admissions_officer` on membership/teacher.
 * Authorization does not use subroles (see DELEGATIONS_FEATURE_SPEC §3); prefer `Delegation`.
 */
export async function grantAdmissionsOfficer(input: {
  schoolId: Types.ObjectId;
  userId: Types.ObjectId;
}): Promise<void> {
  await connectToDatabase();
  await UserMembership.updateOne(
    { schoolId: input.schoolId, userId: input.userId },
    { $addToSet: { subroles: ADMISSIONS_OFFICER_SUBROLE } }
  );
  await Teacher.updateOne(
    { schoolId: input.schoolId, userId: input.userId },
    { $addToSet: { subroles: ADMISSIONS_OFFICER_SUBROLE } }
  );
}

/**
 * Removes the `admissions_officer` subrole from a teacher's UserMembership and
 * Teacher document.
 */
export async function revokeAdmissionsOfficer(input: {
  schoolId: Types.ObjectId;
  userId: Types.ObjectId;
}): Promise<void> {
  await connectToDatabase();
  await UserMembership.updateOne(
    { schoolId: input.schoolId, userId: input.userId },
    { $pull: { subroles: ADMISSIONS_OFFICER_SUBROLE } }
  );
  await Teacher.updateOne(
    { schoolId: input.schoolId, userId: input.userId },
    { $pull: { subroles: ADMISSIONS_OFFICER_SUBROLE } }
  );
}

/**
 * Returns whether the given user has admissions access for the school
 * (school admin or active admissions delegation). Subroles are not used.
 */
export async function hasAdmissionsAccess(input: {
  schoolId: Types.ObjectId;
  userId: Types.ObjectId;
}): Promise<boolean> {
  await connectToDatabase();
  const membership = await UserMembership.findOne({
    schoolId: input.schoolId,
    userId: input.userId,
    status: "active",
  })
    .select("roles")
    .lean();
  if (!membership) return false;
  const roles = (membership.roles ?? []) as string[];
  if (roles.includes("school_admin")) return true;

  const delegations = await findActiveDelegationsForUser(
    input.schoolId,
    input.userId
  );
  return delegations.some(
    (d) =>
      d.module === "admissions" &&
      isDelegationActive(d) &&
      (d.permissions?.length ?? 0) > 0
  );
}

export const ADMISSIONS_OFFICER_SUBROLE_KEY = ADMISSIONS_OFFICER_SUBROLE;
