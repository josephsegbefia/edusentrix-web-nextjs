import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getSchoolSubscriptionSnapshot } from "@/lib/billing/entitlements";
import { LEARN_PLATFORM_SETTINGS_KEY } from "@/lib/learn/platform-settings";
import { LearnPlatformSettings } from "@/models/LearnPlatformSettings";

export type SchoolLearnEligibility = {
  eligible: boolean;
  reason?: string;
  planCode?: string | null;
  planName?: string | null;
  hasLessonFeatures: boolean;
};

const BLOCKED_SUBSCRIPTION_STATUSES = new Set([
  "draft",
  "suspended",
  "cancelled",
  "expired",
  "archived",
]);

const BLOCKED_ACCESS_MODES = new Set([
  "restricted_read_only",
  "suspended",
]);

function normalizeSchoolId(schoolId: Types.ObjectId | string) {
  if (schoolId instanceof Types.ObjectId) return schoolId;
  if (!mongoose.Types.ObjectId.isValid(schoolId)) {
    throw new Error("Invalid schoolId");
  }
  return new Types.ObjectId(schoolId);
}

function isStarterTier(tierCode?: string | null) {
  return (tierCode || "").trim().toLowerCase().includes("starter");
}

export async function getSchoolLearnEligibility(
  schoolId: Types.ObjectId | string
): Promise<SchoolLearnEligibility> {
  await connectToDatabase();

  const schoolIdObj = normalizeSchoolId(schoolId);
  const [snapshot, settings] = await Promise.all([
    getSchoolSubscriptionSnapshot(schoolIdObj),
    LearnPlatformSettings.findOne({
      singletonKey: LEARN_PLATFORM_SETTINGS_KEY,
    }).lean(),
  ]);

  if (!snapshot) {
    return {
      eligible: false,
      reason: "School subscription context was not found.",
      planCode: null,
      planName: null,
      hasLessonFeatures: false,
    };
  }

  const planCode = snapshot.subscription.tierCode;
  const planName = snapshot.subscription.tierName;
  const hasLessonFeatures = snapshot.hasFeature("edusentrix_learn");

  if (settings?.disabled) {
    return {
      eligible: false,
      reason: "EduSentrix Learn is currently disabled by platform settings.",
      planCode,
      planName,
      hasLessonFeatures,
    };
  }

  if ((settings?.starterPlanBlocked ?? true) && isStarterTier(planCode)) {
    return {
      eligible: false,
      reason: "Starter plans are not eligible for EduSentrix Learn.",
      planCode,
      planName,
      hasLessonFeatures,
    };
  }

  if (!hasLessonFeatures) {
    return {
      eligible: false,
      reason: "This school's subscription does not include lesson features required for EduSentrix Learn.",
      planCode,
      planName,
      hasLessonFeatures,
    };
  }

  if (snapshot.schoolStatus !== "active") {
    return {
      eligible: false,
      reason: "This school is not active.",
      planCode,
      planName,
      hasLessonFeatures,
    };
  }

  if (BLOCKED_SUBSCRIPTION_STATUSES.has(snapshot.subscription.normalizedStatus)) {
    return {
      eligible: false,
      reason: "This school's subscription status does not allow EduSentrix Learn.",
      planCode,
      planName,
      hasLessonFeatures,
    };
  }

  if (BLOCKED_ACCESS_MODES.has(snapshot.subscription.accessMode)) {
    return {
      eligible: false,
      reason: "This school's current access mode does not allow EduSentrix Learn.",
      planCode,
      planName,
      hasLessonFeatures,
    };
  }

  return {
    eligible: true,
    planCode,
    planName,
    hasLessonFeatures,
  };
}
