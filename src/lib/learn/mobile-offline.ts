import "server-only";

import { connectToDatabase } from "@/db/connectToDatabase";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { getStudentLearnAccess } from "@/lib/learn/access";
import {
  loadMobileStudentBundle,
  serializeMobileLoginStudent,
} from "@/lib/learn/mobile-student-profile";
import { LessonFlashcardDeck } from "@/models/LessonFlashcardDeck";

export async function buildMobileOfflinePacks(context: LearnMobileStudentContext) {
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
  const decks = await LessonFlashcardDeck.find({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    status: "published",
  })
    .sort({ updatedAt: -1 })
    .limit(6)
    .select("title cardCount subjectOfferingId")
    .lean<Array<{ _id: { toString(): string }; title: string; cardCount?: number }>>();

  const packs = decks.map((deck) => ({
    id: `pack-${String(deck._id)}`,
    title: deck.title,
    subjectName: "Class lesson",
    type: "flashcards" as const,
    sizeMb: Math.max(2, Math.round((deck.cardCount ?? 12) * 0.15)),
    status: "available" as const,
    itemCount: deck.cardCount ?? 12,
    description: "Placeholder pack — real offline caching will connect later.",
  }));

  return {
    ok: true as const,
    data: {
      studentId: profile.studentId,
      syncStatus: "online" as const,
      syncMessage: "Offline packs are preview-only until download caching is approved.",
      storage: { usedMb: 0, limitMb: 256 },
      packs,
    },
  };
}

export async function markMobileOfflinePackDownloaded(
  context: LearnMobileStudentContext,
  packId: string
) {
  const list = await buildMobileOfflinePacks(context);
  if (!list.ok) return list;

  const pack = list.data.packs.find((p) => p.id === packId);
  if (!pack) {
    return {
      ok: false as const,
      code: "PACK_NOT_FOUND",
      message: "Pack not found.",
      status: 404,
    };
  }

  return {
    ok: true as const,
    data: {
      packId,
      status: "downloaded" as const,
      message: "Pack marked for offline use (preview). Real file caching comes later.",
      lastSyncedAt: new Date().toISOString(),
    },
  };
}

export async function removeMobileOfflinePack(context: LearnMobileStudentContext, packId: string) {
  const list = await buildMobileOfflinePacks(context);
  if (!list.ok) return list;

  const pack = list.data.packs.find((p) => p.id === packId);
  if (!pack) {
    return {
      ok: false as const,
      code: "PACK_NOT_FOUND",
      message: "Pack not found.",
      status: 404,
    };
  }

  return {
    ok: true as const,
    data: {
      packId,
      status: "available" as const,
      message: "Pack removed from offline preview list.",
    },
  };
}
