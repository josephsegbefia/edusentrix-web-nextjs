import type { Types } from "mongoose";
import { School } from "@/models/School";
import { User, type IUser } from "@/models/User";

/**
 * School onboarding is driven by a primary school admin user (profile step, billing identity).
 * Prefer the school's creator when set; otherwise the earliest school_admin for the school.
 */
export async function getOnboardingTargetSchoolAdmin(
  schoolId: Types.ObjectId
): Promise<IUser | null> {
  const school = await School.findById(schoolId)
    .select("createdBy")
    .lean<{ createdBy?: Types.ObjectId | null } | null>();

  if (school?.createdBy) {
    const byCreator = await User.findOne({
      _id: school.createdBy,
      schoolId,
    }).lean<IUser | null>();
    if (byCreator) return byCreator;
  }

  return User.findOne({ schoolId, role: "school_admin" })
    .sort({ createdAt: 1 })
    .lean<IUser | null>();
}
