import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { LEARN_PLATFORM_SETTINGS_KEY } from "@/lib/learn/platform-settings";
import { LearnPlatformSettings } from "@/models/LearnPlatformSettings";
import { School } from "@/models/School";

export type SchoolLearnEligibility = {
  eligible: boolean;
  reason?: string;
  planCode?: string | null;
  planName?: string | null;
  hasLessonFeatures: boolean;
};

function normalizeSchoolId(schoolId: Types.ObjectId | string) {
  if (schoolId instanceof Types.ObjectId) return schoolId;
  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    throw new Error("Invalid schoolId");
  }
  return new Types.ObjectId(schoolId);
}

export async function getSchoolLearnEligibility(
  schoolId: Types.ObjectId | string
): Promise<SchoolLearnEligibility> {
  await connectToDatabase();

  const schoolIdObj = normalizeSchoolId(schoolId);
  const [school, settings] = await Promise.all([
    School.findById(schoolIdObj).select("name status").lean<{
      _id: Types.ObjectId;
      name?: string;
      status?: string;
    } | null>(),
    LearnPlatformSettings.findOne({
      singletonKey: LEARN_PLATFORM_SETTINGS_KEY,
    }).lean(),
  ]);

  if (!school) {
    return {
      eligible: false,
      reason: "School not found.",
      planCode: null,
      planName: null,
      hasLessonFeatures: false,
    };
  }

  if (settings?.disabled) {
    return {
      eligible: false,
      reason: "EduSentrix Learn is currently disabled by platform settings.",
      planCode: null,
      planName: null,
      hasLessonFeatures: true,
    };
  }

  if (school.status !== "active") {
    return {
      eligible: false,
      reason: "This school is not active.",
      planCode: null,
      planName: null,
      hasLessonFeatures: true,
    };
  }

  return {
    eligible: true,
    planCode: null,
    planName: null,
    hasLessonFeatures: true,
  };
}
