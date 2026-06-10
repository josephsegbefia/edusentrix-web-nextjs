import "server-only";

import mongoose from "mongoose";
import { UserMembership } from "@/models/UserMembership";

export type UploaderSchoolAccess = {
  membershipSchoolIds: string[];
  activeSchoolId: string | null;
};

/**
 * Lightweight upload school resolution without active-school cookies.
 * UploadThing middleware must not depend on selected-school cookies or throw
 * NextResponse objects from tenant guards.
 */
export async function resolveUploaderSchoolAccess(input: {
  userId: mongoose.Types.ObjectId;
  legacySchoolId?: mongoose.Types.ObjectId | null;
  requestedSchoolId?: string;
}): Promise<UploaderSchoolAccess> {
  const dbMemberships = await UserMembership.find({
    userId: input.userId,
    status: { $in: ["active", "invited"] },
  })
    .select("schoolId")
    .lean<Array<{ schoolId: mongoose.Types.ObjectId }>>();

  const membershipSchoolIds = Array.from(
    new Set(
      [
        ...dbMemberships.map((membership) => String(membership.schoolId)),
        ...(input.legacySchoolId ? [String(input.legacySchoolId)] : []),
      ].filter(Boolean)
    )
  );

  const requested = input.requestedSchoolId?.trim() || null;
  let activeSchoolId: string | null = null;

  if (requested && membershipSchoolIds.includes(requested)) {
    activeSchoolId = requested;
  } else if (dbMemberships.length === 1) {
    activeSchoolId = String(dbMemberships[0].schoolId);
  } else if (input.legacySchoolId) {
    activeSchoolId = String(input.legacySchoolId);
  }

  return { membershipSchoolIds, activeSchoolId };
}
