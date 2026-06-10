import mongoose from "mongoose";
import { School, type ISchool } from "@/models/School";
import { User, type IUser } from "@/models/User";
import { ensureMembershipForUser } from "@/lib/auth/canonical-user";
import { resolveSchoolIdForOnboarding } from "@/lib/onboarding/school-id-for-onboarding";

export async function resolveOnboardingSchoolForUser(input: {
  appUser: IUser;
  email: string;
  clerkSchoolId?: string | null;
}): Promise<ISchool | null> {
  const userId =
    input.appUser._id instanceof mongoose.Types.ObjectId
      ? input.appUser._id
      : new mongoose.Types.ObjectId(String(input.appUser._id));

  const schoolId = await resolveSchoolIdForOnboarding({
    userId,
    email: input.email,
    userSchoolId: input.appUser.schoolId,
    clerkSchoolId: input.clerkSchoolId,
  });

  if (!schoolId) return null;

  const school = (await School.findById(schoolId).lean()) as ISchool | null;
  if (!school) return null;

  const legacyPatch: Record<string, unknown> = {};
  if (!input.appUser.schoolId) {
    legacyPatch.schoolId = schoolId;
  }
  if (!input.appUser.role) {
    legacyPatch.role = "school_admin";
  }
  if (Object.keys(legacyPatch).length > 0) {
    await User.updateOne({ _id: userId }, { $set: legacyPatch });
  }

  await ensureMembershipForUser({
    userId,
    schoolId,
    role: "school_admin",
    status: input.appUser.pendingOnboarding !== false ? "invited" : "active",
  });

  return school;
}
