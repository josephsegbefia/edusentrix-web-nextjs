import "server-only";

import { connectToDatabase } from "@/db/connectToDatabase";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { getStudentLearnAccess } from "@/lib/learn/access";
import {
  loadMobileStudentBundle,
  serializeMobileLoginStudent,
} from "@/lib/learn/mobile-student-profile";
import { LessonSession } from "@/models/LessonSession";

export async function buildMobileAudioItems(context: LearnMobileStudentContext) {
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

  if (!bundle || !context.classGroupId) {
    return {
      ok: false as const,
      code: "NO_STUDENT_PROFILE",
      message: "Student profile not found.",
      status: 404,
    };
  }

  const profile = serializeMobileLoginStudent(bundle);
  const sessions = await LessonSession.find({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    status: "published",
    studentVisibility: "published",
  })
    .sort({ scheduledDate: -1 })
    .limit(5)
    .select("title durationMinutes")
    .lean<Array<{ _id: { toString(): string }; title: string; durationMinutes?: number }>>();

  const items = sessions.map((session, index) => ({
    id: `audio-${String(session._id)}`,
    title: session.title,
    subjectName: "Class lesson",
    durationSeconds: Math.max(60, (session.durationMinutes ?? 5) * 60),
    type: index === 0 ? ("lesson_summary" as const) : ("revision" as const),
    status: index < 2 ? ("coming_soon" as const) : ("coming_soon" as const),
    description: "Listen mode is coming soon. Leo will read approved lesson summaries safely.",
  }));

  return {
    ok: true as const,
    data: {
      studentId: profile.studentId,
      leoMessage: "Audio learning is on the way. For now, read summaries and ask Leo in chat.",
      voiceQuestionStatus: "coming_soon" as const,
      items,
    },
  };
}

export async function markMobileAudioListened(
  context: LearnMobileStudentContext,
  itemId: string
) {
  const list = await buildMobileAudioItems(context);
  if (!list.ok) return list;

  const item = list.data.items.find((i) => i.id === itemId);
  if (!item) {
    return {
      ok: false as const,
      code: "AUDIO_ITEM_NOT_FOUND",
      message: "Audio item not found.",
      status: 404,
    };
  }

  return {
    ok: true as const,
    data: {
      itemId,
      status: "listened" as const,
      message: "Thanks! Full audio playback will arrive in a later update.",
    },
  };
}
