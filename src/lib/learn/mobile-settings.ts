import "server-only";

import { connectToDatabase } from "@/db/connectToDatabase";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { getStudentLearnAccess } from "@/lib/learn/access";
import {
  loadMobileStudentBundle,
  serializeMobileLoginStudent,
} from "@/lib/learn/mobile-student-profile";
import { LearnStudentMobileSettings } from "@/models/LearnStudentMobileSettings";

const DEFAULT_SETTINGS = {
  notificationsEnabled: true,
  dailyReminderEnabled: true,
  dailyReminderTime: "16:30",
  soundEffectsEnabled: true,
  reducedMotionEnabled: false,
  dailyGoalMinutes: 20,
  offlineDownloadsEnabled: false,
  leoTutorHintsFirst: true,
};

export type MobileSettingsPatch = Partial<typeof DEFAULT_SETTINGS>;

async function getOrCreateSettings(context: LearnMobileStudentContext) {
  const existing = await LearnStudentMobileSettings.findOne({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  }).lean();

  if (existing) return existing;

  return LearnStudentMobileSettings.create({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
    ...DEFAULT_SETTINGS,
  });
}

export async function buildMobileSettings(context: LearnMobileStudentContext) {
  await connectToDatabase();

  const access = await getStudentLearnAccess({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  });

  if (!access.hasAccess) {
    return {
      ok: false as const,
      code: access.schoolEligible ? "LEARN_ACCESS_REQUIRED" : "SCHOOL_NOT_ELIGIBLE",
      message: access.blockedReason || "EduSentrix Learn access is required.",
      status: 403,
    };
  }

  const bundle = await loadMobileStudentBundle({
    studentId: context.studentId,
    schoolId: context.schoolId,
    accountId: context.accountId,
  });

  if (!bundle) {
    return {
      ok: false as const,
      code: "NO_STUDENT_PROFILE",
      message: "Student profile not found.",
      status: 404,
    };
  }

  const doc = await getOrCreateSettings(context);
  const profile = serializeMobileLoginStudent(bundle);

  return {
    ok: true as const,
    data: {
      studentId: profile.studentId,
      appVersion: process.env.LEARN_MOBILE_APP_VERSION?.trim() || "1.0.0",
      notificationsEnabled: doc.notificationsEnabled,
      dailyReminderEnabled: doc.dailyReminderEnabled,
      dailyReminderTime: doc.dailyReminderTime,
      soundEffectsEnabled: doc.soundEffectsEnabled,
      reducedMotionEnabled: doc.reducedMotionEnabled,
      dailyGoalMinutes: doc.dailyGoalMinutes,
      offlineDownloadsEnabled: doc.offlineDownloadsEnabled,
      leoTutorHintsFirst: doc.leoTutorHintsFirst,
      supportContact: {
        schoolName: bundle.school.name,
        teacherName: "Your class teacher",
        helpMessage:
          "If something looks wrong, ask your class teacher to check your EduSentrix profile.",
      },
    },
  };
}

export async function patchMobileSettings(
  context: LearnMobileStudentContext,
  patch: MobileSettingsPatch
) {
  await connectToDatabase();

  const access = await getStudentLearnAccess({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  });

  if (!access.hasAccess) {
    return {
      ok: false as const,
      code: access.schoolEligible ? "LEARN_ACCESS_REQUIRED" : "SCHOOL_NOT_ELIGIBLE",
      message: access.blockedReason || "EduSentrix Learn access is required.",
      status: 403,
    };
  }

  const allowed: MobileSettingsPatch = {};
  for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof typeof DEFAULT_SETTINGS>) {
    if (patch[key] !== undefined) {
      allowed[key] = patch[key] as never;
    }
  }

  if (Object.keys(allowed).length === 0) {
    return buildMobileSettings(context);
  }

  await LearnStudentMobileSettings.findOneAndUpdate(
    {
      schoolId: context.schoolId,
      studentId: context.studentId,
      accountId: context.accountId,
    },
    {
      $set: { ...DEFAULT_SETTINGS, ...allowed },
      $setOnInsert: {
        schoolId: context.schoolId,
        studentId: context.studentId,
        accountId: context.accountId,
      },
    },
    { upsert: true, new: true }
  );

  return buildMobileSettings(context);
}
