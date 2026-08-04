import type { Types } from "mongoose";
import { User, type IUser } from "@/models/User";
import { UserMembership } from "@/models/UserMembership";

/**
 * School onboarding is driven by a primary school admin user (profile step, billing identity).
 * Membership is the tenant access source of truth. Legacy User fields remain only
 * as a compatibility fallback for pre-membership records.
 */
export async function getOnboardingTargetSchoolAdmin(
  schoolId: Types.ObjectId
): Promise<IUser | null> {
  const membership = await UserMembership.findOne({
    schoolId,
    roles: "school_admin",
    status: { $in: ["active", "invited"] },
  })
    .sort({ createdAt: 1 })
    .select("userId")
    .lean<{ userId: Types.ObjectId } | null>();

  if (membership?.userId) {
    const memberUser = await User.findById(membership.userId).lean<IUser | null>();
    if (memberUser) return memberUser;
  }

  return User.findOne({ schoolId, role: "school_admin" })
    .sort({ createdAt: 1 })
    .lean<IUser | null>();
}
