import "server-only";

import { Types } from "mongoose";

import { buildExploreAdventureId } from "@/lib/learn/explore/build-generation-key";
import type { GuidedAdventureContentV2 } from "@/lib/learn/explore/explore-schemas";
import {
  EXPLORE_BASE_CONTENT_VERSION,
  type ExploreAiMetadata,
  type ExploreSafetyResult,
  type ExploreSourceContext,
} from "@/lib/learn/explore/explore-types";
import { serializeQuizForStudent } from "@/lib/learn/explore-adventure-content";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { ExploreAdventure, type IExploreAdventure } from "@/models/ExploreAdventure";
import { ExploreContentSnapshot, type IExploreContentSnapshot } from "@/models/ExploreContentSnapshot";
import { StudentExploreRecord, type IStudentExploreRecord } from "@/models/StudentExploreRecord";

/** Mobile-ready adventure payload (compatible with EduSentrix Learn normalizeGuidedAdventure). */
export type MobileExploreAdventurePayload = {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  sourceLessonId: string;
  sourceLessonTitle: string;
  gradeName: string;
  difficulty: GuidedAdventureContentV2["difficulty"];
  estimatedMinutes: number;
  missionType: string;
  adventureAngle: string;
  studentPromise: string;
  intro: string;
  vocabulary: GuidedAdventureContentV2["vocabulary"];
  readingTasks: NonNullable<GuidedAdventureContentV2["readingTasks"]>;
  funFacts: NonNullable<GuidedAdventureContentV2["funFacts"]>;
  relatedLessons: Array<{
    id: string;
    title: string;
    similarityReason: string;
    differentAdventureAngle: string;
  }>;
  contentAudit: {
    contentSnapshotId: string;
    generationId: string;
    generatedBy: "backend_ai";
    contentVersion: string;
    qaStatus: "pending_review" | "teacher_reviewed" | "approved_mock";
    generationPromptSummary: string;
    visibleToRoles: Array<"school_admin" | "class_teacher" | "platform_admin">;
    safetyNotes: string[];
  };
  studentRecord: {
    studentId: string;
    adventureId: string;
    contentSnapshotId: string;
    status: "not_started" | "in_progress" | "quiz_submitted" | "completed";
    startedAt?: string;
    submittedAt?: string;
    completedAt?: string;
    quizScorePercent?: number;
  };
  endingQuiz: ReturnType<typeof serializeQuizForStudent>;
  quiz: {
    submitted: boolean;
    scorePercent?: number;
    correctCount?: number;
    totalCount?: number;
    submittedAt?: string;
  };
  checkpoints: NonNullable<GuidedAdventureContentV2["checkpoints"]>;
  leoPrompts: string[];
  category: "based_on_lesson" | "go_deeper";
  deepDiveExplanation: GuidedAdventureContentV2["deepDiveExplanation"];
  misconceptions: GuidedAdventureContentV2["misconceptions"];
  tryItActivity?: GuidedAdventureContentV2["tryItActivity"];
  parentConversationPrompt?: GuidedAdventureContentV2["parentConversationPrompt"];
  curiosityPathways: GuidedAdventureContentV2["curiosityPathways"];
  generationState?: "ready";
  reviewStatus?: string;
  completionRewards?: import("@/lib/learn/explore/explore-completion-rewards").ExploreCompleteRewardPayload;
};

export function serializeExploreAdventureForStudent(input: {
  adventure: Pick<
    IExploreAdventure,
    | "_id"
    | "title"
    | "subjectName"
    | "sourceLessonTitle"
    | "difficulty"
    | "estimatedMinutes"
    | "missionType"
    | "reviewStatus"
  >;
  snapshot: Pick<IExploreContentSnapshot, "_id" | "generationKey" | "content" | "aiMetadata" | "safetyResult">;
  studentId: string;
  record?: Pick<
    IStudentExploreRecord,
    | "status"
    | "startedAt"
    | "quizSubmittedAt"
    | "completedAt"
    | "quizScorePercent"
    | "correctCount"
    | "totalCount"
  > | null;
  relatedLessonTitles?: string[];
  sourceContext: ExploreSourceContext;
  includeQuizAnswers?: boolean;
}): MobileExploreAdventurePayload {
  const content = input.snapshot.content;
  const adventureId = buildExploreAdventureId(input.adventure._id);
  const record = input.record;

  const endingQuiz = input.includeQuizAnswers
    ? content.endingQuiz
    : serializeQuizForStudent(content.endingQuiz);

  return {
    id: adventureId,
    title: input.adventure.title,
    subjectId: input.sourceContext.subjectId,
    subjectName: content.subjectName,
    sourceLessonId: content.sourceLessonId,
    sourceLessonTitle: content.sourceLessonTitle,
    gradeName: content.gradeName,
    difficulty: input.adventure.difficulty,
    estimatedMinutes: input.adventure.estimatedMinutes,
    missionType: input.adventure.missionType,
    adventureAngle: content.adventureAngle,
    studentPromise: content.studentPromise,
    intro: content.intro,
    vocabulary: content.vocabulary ?? [],
    readingTasks: content.readingTasks ?? [],
    funFacts: content.funFacts ?? [],
    relatedLessons: (input.relatedLessonTitles ?? []).map((title, index) => ({
      id: `related-${index}`,
      title,
      similarityReason: "Same subject in your class",
      differentAdventureAngle: "Leo used a different Explore angle for this lesson.",
    })),
    contentAudit: {
      contentSnapshotId: String(input.snapshot._id),
      generationId: input.snapshot.generationKey,
      generatedBy: "backend_ai",
      contentVersion: EXPLORE_BASE_CONTENT_VERSION,
      qaStatus:
        input.snapshot.safetyResult.status === "teacher_review_required"
          ? "pending_review"
          : "pending_review",
      generationPromptSummary: input.snapshot.aiMetadata.generationPromptSummary,
      visibleToRoles: ["school_admin", "class_teacher", "platform_admin"],
      safetyNotes: input.snapshot.safetyResult.finalNotes,
    },
    studentRecord: {
      studentId: input.studentId,
      adventureId,
      contentSnapshotId: String(input.snapshot._id),
      status: record?.status ?? "not_started",
      startedAt: record?.startedAt?.toISOString(),
      submittedAt: record?.quizSubmittedAt?.toISOString(),
      completedAt: record?.completedAt?.toISOString(),
      quizScorePercent: record?.quizScorePercent ?? undefined,
    },
    endingQuiz,
    quiz: record?.quizSubmittedAt
      ? {
          submitted: true,
          scorePercent: record.quizScorePercent ?? undefined,
          correctCount: record.correctCount ?? undefined,
          totalCount: record.totalCount ?? undefined,
          submittedAt: record.quizSubmittedAt.toISOString(),
        }
      : { submitted: false },
    checkpoints: content.checkpoints ?? [],
    leoPrompts: content.leoPrompts ?? [],
    category: content.category ?? "go_deeper",
    deepDiveExplanation: content.deepDiveExplanation,
    misconceptions: content.misconceptions,
    tryItActivity: content.tryItActivity,
    parentConversationPrompt: content.parentConversationPrompt,
    curiosityPathways: content.curiosityPathways,
    generationState: "ready",
    reviewStatus: input.adventure.reviewStatus,
  };
}

export async function ensureStudentExploreRecord(input: {
  auth: LearnMobileStudentContext;
  adventureId: Types.ObjectId;
  contentSnapshotId: Types.ObjectId;
}) {
  const record = await StudentExploreRecord.findOneAndUpdate(
    {
      studentId: input.auth.studentId,
      adventureId: input.adventureId,
    },
    {
      $setOnInsert: {
        schoolId: input.auth.schoolId,
        classGroupId: input.auth.classGroupId!,
        accountId: input.auth.accountId,
        adventureId: input.adventureId,
        contentSnapshotId: input.contentSnapshotId,
        status: "not_started",
      },
    },
    { upsert: true, new: true }
  ).lean();

  return record as IStudentExploreRecord;
}

export async function saveExploreAdventureBundle(input: {
  generationKey: string;
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  subjectOfferingId: Types.ObjectId;
  lessonId: Types.ObjectId;
  gradeLevel: string;
  content: GuidedAdventureContentV2;
  sourceContext: ExploreSourceContext;
  aiMetadata: ExploreAiMetadata;
  safetyResult: ExploreSafetyResult;
  adventureStatus?: IExploreAdventure["status"];
  /** When set, replaces the current snapshot on an existing class adventure (admin regenerate). */
  existingAdventureId?: Types.ObjectId;
}) {
  const adventureStatus =
    input.safetyResult.status === "blocked"
      ? "blocked"
      : input.safetyResult.status === "teacher_review_required"
        ? "teacher_review_recommended"
        : input.adventureStatus ?? "ready";

  if (input.existingAdventureId) {
    const existing = await ExploreAdventure.findOne({
      _id: input.existingAdventureId,
      schoolId: input.schoolId,
    });

    if (!existing) {
      throw new Error("Explore adventure not found for snapshot replace.");
    }

    const snapshot = await ExploreContentSnapshot.create({
      adventureId: existing._id,
      generationKey: input.generationKey,
      contentVersion: EXPLORE_BASE_CONTENT_VERSION,
      schemaVersion: "explore_adventure_v2",
      content: input.content,
      sourceContext: input.sourceContext,
      aiMetadata: input.aiMetadata,
      safetyResult: input.safetyResult,
      visibleToRoles: ["student", "class_teacher", "school_admin", "platform_admin"],
    });

    existing.generationKey = input.generationKey;
    existing.title = input.content.title;
    existing.subjectName = input.content.subjectName;
    existing.sourceLessonTitle = input.content.sourceLessonTitle;
    existing.difficulty = input.content.difficulty;
    existing.estimatedMinutes = input.content.estimatedMinutes;
    existing.missionType = input.content.missionType;
    existing.gradeLevel = input.gradeLevel;
    existing.status = adventureStatus;
    existing.reviewStatus = "not_reviewed";
    existing.currentSnapshotId = snapshot._id;
    existing.generatedAt = new Date();
    await existing.save();

    return {
      adventure: existing.toObject() as IExploreAdventure,
      snapshot: snapshot.toObject() as IExploreContentSnapshot,
    };
  }

  const adventureId = new Types.ObjectId();
  const snapshotId = new Types.ObjectId();

  const snapshot = await ExploreContentSnapshot.create({
    _id: snapshotId,
    adventureId,
    generationKey: input.generationKey,
    contentVersion: EXPLORE_BASE_CONTENT_VERSION,
    schemaVersion: "explore_adventure_v2",
    content: input.content,
    sourceContext: input.sourceContext,
    aiMetadata: input.aiMetadata,
    safetyResult: input.safetyResult,
    visibleToRoles: ["student", "class_teacher", "school_admin", "platform_admin"],
  });

  try {
    const adventure = await ExploreAdventure.create({
      _id: adventureId,
      generationKey: input.generationKey,
      schoolId: input.schoolId,
      classGroupId: input.classGroupId,
      subjectOfferingId: input.subjectOfferingId,
      lessonId: input.lessonId,
      gradeLevel: input.gradeLevel,
      title: input.content.title,
      subjectName: input.content.subjectName,
      sourceLessonTitle: input.content.sourceLessonTitle,
      difficulty: input.content.difficulty,
      estimatedMinutes: input.content.estimatedMinutes,
      missionType: input.content.missionType,
      status: adventureStatus,
      reviewStatus: "not_reviewed",
      currentSnapshotId: snapshot._id,
      createdBy: "leo_ai",
      generatedAt: new Date(),
    });

    return {
      adventure: adventure.toObject() as IExploreAdventure,
      snapshot: snapshot.toObject() as IExploreContentSnapshot,
    };
  } catch (error) {
    const isDuplicate =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000;

    if (!isDuplicate) throw error;

    const existing = await ExploreAdventure.findOne({
      generationKey: input.generationKey,
    }).lean<IExploreAdventure | null>();

    if (!existing) throw error;

    const existingSnapshot = await ExploreContentSnapshot.findById(
      existing.currentSnapshotId
    ).lean<IExploreContentSnapshot | null>();

    if (!existingSnapshot) throw error;

    return { adventure: existing, snapshot: existingSnapshot };
  }
}

export async function loadExploreSnapshotForAdventure(adventureId: Types.ObjectId) {
  const adventure = await ExploreAdventure.findById(adventureId).lean<IExploreAdventure | null>();
  if (!adventure) return null;

  const snapshot = await ExploreContentSnapshot.findById(adventure.currentSnapshotId).lean<
    IExploreContentSnapshot | null
  >();
  if (!snapshot) return null;

  return { adventure, snapshot };
}

const READY_STATUSES = ["teacher_approved"] as const;

export async function loadFallbackExploreAdventures(input: {
  auth: LearnMobileStudentContext;
  excludeGenerationKey?: string;
  limit?: number;
}): Promise<MobileExploreAdventurePayload[]> {
  if (!input.auth.classGroupId) return [];

  const query: Record<string, unknown> = {
    schoolId: input.auth.schoolId,
    classGroupId: input.auth.classGroupId,
    status: { $in: READY_STATUSES },
  };

  if (input.excludeGenerationKey) {
    query.generationKey = { $ne: input.excludeGenerationKey };
  }

  const adventures = await ExploreAdventure.find(query)
    .sort({ updatedAt: -1 })
    .limit(input.limit ?? 3)
    .lean<IExploreAdventure[]>();

  const payloads: MobileExploreAdventurePayload[] = [];

  for (const adventure of adventures) {
    const loaded = await loadExploreSnapshotForAdventure(adventure._id);
    if (!loaded) continue;

    const record = await StudentExploreRecord.findOne({
      studentId: input.auth.studentId,
      adventureId: adventure._id,
    }).lean<IStudentExploreRecord | null>();

    payloads.push(
      serializeExploreAdventureForStudent({
        adventure,
        snapshot: loaded.snapshot,
        studentId: String(input.auth.studentId),
        record,
        sourceContext: loaded.snapshot.sourceContext,
      })
    );
  }

  return payloads;
}
