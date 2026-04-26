// src/lib/admissions/access.ts
// Server-side helpers used by Admissions APIs and (lightly) by client hooks
// to check whether a user can manage admissions or has been delegated.
//
// See docs/ADMISSIONS_DEVELOPMENT_SPEC.md §4.

import { connectToDatabase } from "@/db/connectToDatabase";
import { UserMembership } from "@/models/UserMembership";
import { Teacher } from "@/models/Teacher";
import type { Types } from "mongoose";

const ADMISSIONS_OFFICER_SUBROLE = "admissions_officer" as const;

/**
 * Adds the `admissions_officer` subrole to a teacher's UserMembership and
 * mirrors it onto the Teacher document for backward compatibility with the
 * legacy `Teacher.subroles` permission resolver.
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
 * (either as the school admin or as a teacher delegate).
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
    .select("roles subroles")
    .lean();
  if (!membership) return false;
  const roles = (membership.roles ?? []) as string[];
  const subroles = (membership.subroles ?? []) as string[];
  return (
    roles.includes("school_admin") ||
    subroles.includes(ADMISSIONS_OFFICER_SUBROLE)
  );
}

export const ADMISSIONS_OFFICER_SUBROLE_KEY = ADMISSIONS_OFFICER_SUBROLE;
