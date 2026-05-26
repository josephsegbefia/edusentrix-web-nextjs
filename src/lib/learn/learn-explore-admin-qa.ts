import "server-only";

import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import {
  buildExploreAdventureId,
  parseExploreAdventureId,
} from "@/lib/learn/explore/build-generation-key";
import type {
  ExploreAiMetadata,
  ExploreAdventureReviewStatus,
  ExploreAdventureStatus,
  ExploreReviewerRole,
  ExploreReviewAction,
  ExploreSourceContext,
  GuidedAdventureContentV2,
} from "@/lib/learn/explore/explore-types";
import { ClassGroup } from "@/models/ClassGroup";
import { ExploreAdventure, type IExploreAdventure } from "@/models/ExploreAdventure";
import { ExploreContentReview } from "@/models/ExploreContentReview";
import {
  ExploreContentSnapshot,
  type IExploreContentSnapshot,
} from "@/models/ExploreContentSnapshot";
import { StudentExploreRecord } from "@/models/StudentExploreRecord";

export type ExploreAdminQaListItem = {
  adventureId: string;
  title: string;
  subjectName: string;
  classGroupId: string;
  classGroupName: string;
  sourceLessonTitle: string;
  gradeLevel: string;
  missionType: string;
  generatedAt: string;
  updatedAt: string;
  safetyStatus: string;
  adventureStatus: ExploreAdventureStatus;
  reviewStatus: ExploreAdventureReviewStatus;
  studentsViewedCount: number;
  studentsCompletedCount: number;
  reportsCount: number;
  introPreview: string;
  contentVersion: string;
  isHidden: boolean;
};

export type ExploreAdminQaDetail = ExploreAdminQaListItem & {
  content: GuidedAdventureContentV2;
  safetyNotes: string[];
  safetyChecks: Array<{ name: string; passed: boolean; severity: string; note?: string }>;
  aiSummary: string;
  aiMetadata: ExploreAiMetadata;
  sourceContext: ExploreSourceContext;
  generationKey: string;
  contentSnapshotId: string;
  reports: Array<{
    id: string;
    action: string;
    reason: string | null;
    notes: string | null;
    reportedByStudentId: string | null;
    createdAt: string;
  }>;
  reviewHistory: Array<{
    id: string;
    action: string;
    notes: string | null;
    reviewerRole: string;
    createdAt: string;
  }>;
  studentSummary: {
    viewedCount: number;
    completedCount: number;
    quizSubmittedCount: number;
    averageQuizScorePercent: number | null;
  };
};

export type ExploreAdminReviewActionInput =
  | "approve"
  | "mark_reviewed"
  | "hide"
  | "request_changes";

function formatClassName(name: string) {
  return name?.trim() || "Class";
}

export async function listSchoolLazyExploreForAdminQa(
  schoolId: Types.ObjectId,
  filters?: {
    classGroupId?: string;
    limit?: number;
  }
) {
  await connectToDatabase();

  const query: Record<string, unknown> = {
    schoolId,
    status: { $ne: "archived" },
  };

  if (filters?.classGroupId && Types.ObjectId.isValid(filters.classGroupId)) {
    query.classGroupId = new Types.ObjectId(filters.classGroupId);
  }

  const limit = Math.min(filters?.limit ?? 40, 100);

  const adventures = await ExploreAdventure.find(query)
    .sort({ generatedAt: -1 })
    .limit(limit)
    .lean<IExploreAdventure[]>();

  if (!adventures.length) {
    return { adventures: [] as ExploreAdminQaListItem[], total: 0, source: "lazy" as const };
  }

  const adventureIds = adventures.map((row) => row._id);
  const classIds = Array.from(new Set(adventures.map((row) => String(row.classGroupId))));
  const snapshotIds = adventures.map((row) => row.currentSnapshotId);

  const [classes, snapshots, recordStats, reportStats] = await Promise.all([
    ClassGroup.find({ schoolId, _id: { $in: classIds } })
      .select("_id name")
      .lean<Array<{ _id: Types.ObjectId; name: string }>>(),
    ExploreContentSnapshot.find({ _id: { $in: snapshotIds } })
      .select("_id safetyResult contentVersion content.intro")
      .lean<
        Array<{
          _id: Types.ObjectId;
          safetyResult: IExploreContentSnapshot["safetyResult"];
          contentVersion: string;
          content: { intro?: string };
        }>
      >(),
    StudentExploreRecord.aggregate<{
      _id: Types.ObjectId;
      viewed: number;
      completed: number;
    }>([
      {
        $match: {
          schoolId,
          adventureId: { $in: adventureIds },
        },
      },
      {
        $group: {
          _id: "$adventureId",
          viewed: {
            $sum: {
              $cond: [{ $ne: ["$status", "not_started"] }, 1, 0],
            },
          },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
            },
          },
        },
      },
    ]),
    ExploreContentReview.aggregate<{ _id: Types.ObjectId; count: number }>([
      {
        $match: {
          schoolId,
          adventureId: { $in: adventureIds },
          $or: [{ action: "reported" }, { reportedByStudentId: { $ne: null } }],
        },
      },
      { $group: { _id: "$adventureId", count: { $sum: 1 } } },
    ]),
  ]);

  const classMap = new Map(classes.map((row) => [String(row._id), formatClassName(row.name)]));
  const snapshotMap = new Map(snapshots.map((row) => [String(row._id), row]));
  const viewedMap = new Map(recordStats.map((row) => [String(row._id), row.viewed]));
  const completedMap = new Map(recordStats.map((row) => [String(row._id), row.completed]));
  const reportsMap = new Map(reportStats.map((row) => [String(row._id), row.count]));

  const items: ExploreAdminQaListItem[] = adventures.map((row) => {
    const snapshot = snapshotMap.get(String(row.currentSnapshotId));
    const safetyStatus = snapshot?.safetyResult?.status ?? "unknown";

    return {
      adventureId: buildExploreAdventureId(row._id),
      title: row.title,
      subjectName: row.subjectName,
      classGroupId: String(row.classGroupId),
      classGroupName: classMap.get(String(row.classGroupId)) ?? "Class",
      sourceLessonTitle: row.sourceLessonTitle,
      gradeLevel: row.gradeLevel,
      missionType: row.missionType,
      generatedAt: row.generatedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      safetyStatus,
      adventureStatus: row.status,
      reviewStatus: row.reviewStatus,
      studentsViewedCount: viewedMap.get(String(row._id)) ?? 0,
      studentsCompletedCount: completedMap.get(String(row._id)) ?? 0,
      reportsCount: reportsMap.get(String(row._id)) ?? 0,
      introPreview: snapshot?.content?.intro?.slice(0, 160) ?? "",
      contentVersion: snapshot?.contentVersion ?? "",
      isHidden: row.status === "hidden",
    };
  });

  return { adventures: items, total: items.length, source: "lazy" as const };
}

export async function getLazyExploreDetailForAdminQa(
  schoolId: Types.ObjectId,
  adventureId: string,
  scope?: { classGroupIds?: Types.ObjectId[] }
) {
  await connectToDatabase();

  const objectIdHex = parseExploreAdventureId(adventureId);
  if (!objectIdHex) return null;

  const query: Record<string, unknown> = {
    _id: new Types.ObjectId(objectIdHex),
    schoolId,
  };

  if (scope?.classGroupIds?.length) {
    query.classGroupId = { $in: scope.classGroupIds };
  }

  const adventure = await ExploreAdventure.findOne(query).lean<IExploreAdventure | null>();
  if (!adventure) return null;

  const snapshot = await ExploreContentSnapshot.findById(adventure.currentSnapshotId).lean<
    IExploreContentSnapshot | null
  >();
  if (!snapshot) return null;

  const [classGroup, reports, recordStats] = await Promise.all([
    ClassGroup.findById(adventure.classGroupId).select("name").lean<{ name: string } | null>(),
    ExploreContentReview.find({
      schoolId,
      adventureId: adventure._id,
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean<
        Array<{
          _id: Types.ObjectId;
          action: ExploreReviewAction;
          reason?: string | null;
          notes?: string | null;
          reviewerRole: string;
          reportedByStudentId?: Types.ObjectId | null;
          createdAt: Date;
        }>
      >(),
    StudentExploreRecord.aggregate<{
      viewed: number;
      completed: number;
      quizSubmitted: number;
      avgScore: number | null;
    }>([
      { $match: { schoolId, adventureId: adventure._id } },
      {
        $group: {
          _id: null,
          viewed: {
            $sum: { $cond: [{ $ne: ["$status", "not_started"] }, 1, 0] },
          },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          quizSubmitted: {
            $sum: {
              $cond: [
                { $in: ["$status", ["quiz_submitted", "completed"]] },
                1,
                0,
              ],
            },
          },
          avgScore: { $avg: "$quizScorePercent" },
        },
      },
    ]),
  ]);

  const stats = recordStats[0] ?? {
    viewed: 0,
    completed: 0,
    quizSubmitted: 0,
    avgScore: null,
  };

  const base: ExploreAdminQaListItem = {
    adventureId: buildExploreAdventureId(adventure._id),
    title: adventure.title,
    subjectName: adventure.subjectName,
    classGroupId: String(adventure.classGroupId),
    classGroupName: formatClassName(classGroup?.name ?? "Class"),
    sourceLessonTitle: adventure.sourceLessonTitle,
    gradeLevel: adventure.gradeLevel,
    missionType: adventure.missionType,
    generatedAt: adventure.generatedAt.toISOString(),
    updatedAt: adventure.updatedAt.toISOString(),
    safetyStatus: snapshot.safetyResult.status,
    adventureStatus: adventure.status,
    reviewStatus: adventure.reviewStatus,
    studentsViewedCount: stats.viewed,
    studentsCompletedCount: stats.completed,
    reportsCount: reports.filter(
      (row) => row.action === "reported" || row.reportedByStudentId
    ).length,
    introPreview: snapshot.content.intro?.slice(0, 160) ?? "",
    contentVersion: snapshot.contentVersion,
    isHidden: adventure.status === "hidden",
  };

  const detail: ExploreAdminQaDetail = {
    ...base,
    content: snapshot.content,
    safetyNotes: snapshot.safetyResult.finalNotes ?? [],
    safetyChecks: (snapshot.safetyResult.checks ?? []).map((check) => ({
      name: check.name,
      passed: check.passed,
      severity: check.severity,
      note: check.note ?? undefined,
    })),
    aiSummary: snapshot.aiMetadata.generationPromptSummary,
    aiMetadata: snapshot.aiMetadata,
    sourceContext: snapshot.sourceContext,
    generationKey: snapshot.generationKey,
    contentSnapshotId: String(snapshot._id),
    reviewHistory: reports.map((row) => ({
      id: String(row._id),
      action: row.action,
      notes: row.notes ?? row.reason ?? null,
      reviewerRole: row.reviewerRole,
      createdAt: row.createdAt.toISOString(),
    })),
    reports: reports
      .filter((row) => row.action === "reported" || row.reportedByStudentId)
      .map((row) => ({
      id: String(row._id),
      action: row.action,
      reason: row.reason ?? null,
      notes: row.notes ?? null,
      reportedByStudentId: row.reportedByStudentId ? String(row.reportedByStudentId) : null,
      createdAt: row.createdAt.toISOString(),
    })),
    studentSummary: {
      viewedCount: stats.viewed,
      completedCount: stats.completed,
      quizSubmittedCount: stats.quizSubmitted,
      averageQuizScorePercent:
        stats.avgScore != null ? Math.round(stats.avgScore) : null,
    },
  };

  return detail;
}

export async function applyExploreAdminReviewAction(input: {
  schoolId: Types.ObjectId;
  reviewerId: Types.ObjectId;
  reviewerRole: ExploreReviewerRole;
  adventureId: string;
  action: ExploreAdminReviewActionInput;
  notes?: string;
}) {
  await connectToDatabase();

  const objectIdHex = parseExploreAdventureId(input.adventureId);
  if (!objectIdHex) {
    throw new Error("Invalid adventure id.");
  }

  const adventure = await ExploreAdventure.findOne({
    _id: new Types.ObjectId(objectIdHex),
    schoolId: input.schoolId,
  });

  if (!adventure) {
    throw new Error("Explore adventure not found.");
  }

  let reviewAction: ExploreReviewAction = "approved";
  let nextStatus: ExploreAdventureStatus = adventure.status;
  let nextReviewStatus: ExploreAdventureReviewStatus = adventure.reviewStatus;

  switch (input.action) {
    case "approve":
      reviewAction = "approved";
      nextStatus = "teacher_approved";
      nextReviewStatus = "approved";
      break;
    case "mark_reviewed":
      reviewAction = "marked_safe";
      nextReviewStatus = "reviewed";
      if (nextStatus === "teacher_review_recommended") {
        nextStatus = "ready";
      }
      break;
    case "hide":
      reviewAction = "hidden";
      nextStatus = "hidden";
      nextReviewStatus = "rejected";
      break;
    case "request_changes":
      reviewAction = "requested_changes";
      nextStatus = "teacher_review_recommended";
      nextReviewStatus = "needs_changes";
      break;
    default:
      throw new Error("Unsupported review action.");
  }

  adventure.status = nextStatus;
  adventure.reviewStatus = nextReviewStatus;
  await adventure.save();

  await ExploreContentReview.create({
    adventureId: adventure._id,
    contentSnapshotId: adventure.currentSnapshotId,
    schoolId: input.schoolId,
    reviewerId: input.reviewerId,
    reviewerRole: input.reviewerRole,
    action: reviewAction,
    notes: input.notes?.trim() || null,
  });

  return {
    adventureId: buildExploreAdventureId(adventure._id),
    status: adventure.status,
    reviewStatus: adventure.reviewStatus,
    action: input.action,
  };
}
