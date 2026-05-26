import "server-only";

import { connectToDatabase } from "@/db/connectToDatabase";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { getStudentLearnAccess } from "@/lib/learn/access";
import {
  ActivityRow,
  computeStreakDays,
  levelFromXp,
  xpForEvent,
} from "@/lib/learn/mobile-learn-progress";
import {
  loadMobileStudentBundle,
  serializeMobileLoginStudent,
} from "@/lib/learn/mobile-student-profile";
import { ClassGroup } from "@/models/ClassGroup";
import { LearnActivityEvent } from "@/models/LearnActivityEvent";
import { SubjectOffering } from "@/models/SubjectOffering";

const PROFILE_SETTINGS = [
  {
    id: "notifications",
    title: "Learning reminders",
    description: "Daily quest and streak reminders from your school learning plan.",
    icon: "notifications" as const,
    status: "On",
  },
  {
    id: "downloads",
    title: "Offline learning",
    description: "Saved lessons and practice packs from your class.",
    icon: "download" as const,
    status: "Available",
  },
  {
    id: "privacy",
    title: "Privacy and safety",
    description: "Your school controls approved content and Learn access.",
    icon: "shield-checkmark" as const,
  },
  {
    id: "help",
    title: "Help from school",
    description: "Ask your teacher or school admin if your class information looks wrong.",
    icon: "help-circle" as const,
  },
  {
    id: "logout",
    title: "Sign out",
    description: "Sign out of EduSentrix Learn on this device.",
    icon: "log-out" as const,
    destructive: true,
  },
];

export async function buildMobileStudentProfile(context: LearnMobileStudentContext) {
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

  const loginStudent = serializeMobileLoginStudent(bundle);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [monthEvents, classGroup] = await Promise.all([
    LearnActivityEvent.find({
      schoolId: context.schoolId,
      studentId: context.studentId,
      occurredAt: { $gte: thirtyDaysAgo },
      eventType: { $ne: "login" },
    })
      .sort({ occurredAt: -1 })
      .limit(200)
      .lean<ActivityRow[]>(),
    bundle.student.classGroupId
      ? ClassGroup.findOne({
          _id: bundle.student.classGroupId,
          schoolId: context.schoolId,
        })
          .select("subjectOfferingIds")
          .lean<{ subjectOfferingIds?: Array<{ toString(): string }> } | null>()
      : Promise.resolve(null),
  ]);

  const monthXp = monthEvents.reduce((sum, e) => sum + xpForEvent(e), 0);
  const { level, levelTitle, nextLevelXp } = levelFromXp(monthXp);
  const streakDays = computeStreakDays(monthEvents.map((e) => e.occurredAt));
  const questCount = monthEvents.filter((e) => e.eventType === "quest_completed").length;
  const badgeSignals = new Set(
    monthEvents.map((e) => e.eventType).filter((t) => t !== "login")
  );

  const offeringIds = classGroup?.subjectOfferingIds ?? [];
  const offerings =
    offeringIds.length > 0
      ? await SubjectOffering.find({
          _id: { $in: offeringIds },
          schoolId: context.schoolId,
        })
          .select("displayName shortName")
          .lean<Array<{ displayName: string; shortName?: string }>>()
      : [];

  const subjects = offerings.map((o) => o.shortName || o.displayName).filter(Boolean);

  const studentRow = bundle.student as {
    admissionNo?: string | null;
  };

  return {
    ok: true as const,
    data: {
      student: {
        studentId: loginStudent.studentId,
        displayName: loginStudent.displayName,
        admissionNumber: studentRow.admissionNo?.trim() || "—",
        schoolName: loginStudent.schoolName,
        gradeName: loginStudent.gradeName || "Your grade",
        classGroupName: loginStudent.classGroupName || "Your class",
        academicYearName: loginStudent.academicYearName ?? "Current year",
        termName: loginStudent.termName ?? "Current term",
        premiumAccess: loginStudent.premiumAccess,
      },
      summary: {
        level,
        levelTitle,
        currentXp: monthXp,
        nextLevelXp,
        streakDays,
        completedQuests: questCount,
        badgesEarned: badgeSignals.size,
      },
      subjects,
      settings: PROFILE_SETTINGS,
    },
  };
}
