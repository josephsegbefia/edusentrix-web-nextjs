import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { UserMembership } from "@/models/UserMembership";
import {
  findActiveDelegationIdForPermission,
  mergedDelegationPermissions,
} from "@/lib/delegations/service";

export type DelegatedAuthResult = {
  isSchoolAdmin: boolean;
  permissions: string[];
  /** Set when a delegate satisfies `permission` via an active delegation row. */
  activeDelegationId: mongoose.Types.ObjectId | null;
};

/**
 * Generic gate for future modules: school admin always passes; otherwise merged
 * active delegation permission strings must include `permission`.
 */
export async function requireSchoolAdminOrDelegatedPermission(input: {
  schoolId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  permission: string;
}): Promise<DelegatedAuthResult> {
  await connectToDatabase();
  const membership = await UserMembership.findOne({
    schoolId: input.schoolId,
    userId: input.userId,
    status: "active",
  })
    .select({ roles: 1 })
    .lean<{ roles?: string[] } | null>();

  if (!membership) {
    throw NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const roles = (membership.roles ?? []) as string[];
  if (roles.includes("school_admin")) {
    return { isSchoolAdmin: true, permissions: [], activeDelegationId: null };
  }

  const permissions = await mergedDelegationPermissions(input.schoolId, input.userId);
  if (!permissions.includes(input.permission)) {
    throw NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const activeDelegationId = await findActiveDelegationIdForPermission({
    schoolId: input.schoolId,
    staffUserId: input.userId,
    permission: input.permission,
  });
  return { isSchoolAdmin: false, permissions, activeDelegationId };
}
