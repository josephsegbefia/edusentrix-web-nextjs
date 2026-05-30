import mongoose, { Types } from "mongoose";
import { AssessmentItem } from "@/models/AssessmentItem";
import { EXAM_TIMETABLE_ENTRY_SOURCE_REF_TYPE } from "@/constants/academics/exam-scheduling-engine";
import { ExamSession, type IExamSession } from "@/models/ExamSession";
import { ExamTimetableEntry } from "@/models/ExamTimetableEntry";
import { ExamTimetableVersion } from "@/models/ExamTimetableVersion";
import { runExamSessionConflictCheck } from "@/lib/exams/exam-conflict-service";
import {
  listMissingAssessmentLinkEntries,
  type ExamAssessmentLinkEntryInput,
  type ExamAssessmentLinkItemInput,
} from "@/lib/exams/exam-assessment-link-validation";
import { toEntryInput } from "@/lib/exams/exam-assessment-link-service";
import type { IExamTimetableEntry } from "@/models/ExamTimetableEntry";
import { buildPublishReadinessSummary } from "@/lib/exams/exam-readiness-validation";
import type { ExamPublishReadinessDTO } from "@/types/academics/exam-scheduling-engine";

export class ExamReadinessServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExamReadinessServiceError";
    this.status = status;
  }
}

const BLOCKED_SESSION_STATUSES = new Set(["locked", "archived", "cancelled"]);

function toItemInput(item: {
  _id: mongoose.Types.ObjectId;
  schoolId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  classGroupId: mongoose.Types.ObjectId;
  contributesToReport: boolean;
  componentKey?: string | null;
  maxScore: number;
  sourceRefType?: string | null;
  sourceRefId?: mongoose.Types.ObjectId | null;
  status: string;
}): ExamAssessmentLinkItemInput {
  return {
    id: String(item._id),
    schoolId: String(item.schoolId),
    academicPeriodId: String(item.academicPeriodId),
    subjectId: String(item.subjectId),
    classGroupId: String(item.classGroupId),
    contributesToReport: item.contributesToReport,
    componentKey: item.componentKey ?? null,
    maxScore: item.maxScore,
    sourceRefType: item.sourceRefType ?? null,
    sourceRefId: item.sourceRefId ? String(item.sourceRefId) : null,
    status: item.status,
  };
}

async function loadExamSession(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
}): Promise<IExamSession> {
  if (!mongoose.Types.ObjectId.isValid(input.sessionId)) {
    throw new ExamReadinessServiceError("Invalid exam session id.", 400);
  }

  const session = await ExamSession.findOne({
    _id: input.sessionId,
    schoolId: input.schoolId,
  });

  if (!session) {
    throw new ExamReadinessServiceError("Exam session not found.", 404);
  }

  return session;
}

export async function getExamSessionPublishReadiness(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  sessionId: string;
}): Promise<ExamPublishReadinessDTO> {
  const session = await loadExamSession(input);

  if (BLOCKED_SESSION_STATUSES.has(session.status)) {
    throw new ExamReadinessServiceError(
      "Publish readiness is not available for archived, locked, or cancelled exam sessions.",
      409
    );
  }

  const [conflictCheck, entries, currentVersion] = await Promise.all([
    runExamSessionConflictCheck({
      schoolId: input.schoolId,
      actorId: input.actorId,
      sessionId: input.sessionId,
    }),
    ExamTimetableEntry.find({
      schoolId: input.schoolId,
      examSessionId: session._id,
    }).lean(),
    ExamTimetableVersion.findOne({
      schoolId: input.schoolId,
      examSessionId: session._id,
      status: "published",
    })
      .sort({ versionNumber: -1 })
      .select("versionNumber")
      .lean(),
  ]);

  const entryDocs = entries as IExamTimetableEntry[];
  const entryIds = entryDocs.map((entry) => entry._id as Types.ObjectId);
  const linkedItems = entryIds.length
    ? await AssessmentItem.find({
        schoolId: input.schoolId,
        sourceRefType: EXAM_TIMETABLE_ENTRY_SOURCE_REF_TYPE,
        sourceRefId: { $in: entryIds },
      }).lean()
    : [];

  const linkedItemsByEntryId: Record<string, ExamAssessmentLinkItemInput[]> = {};
  for (const item of linkedItems) {
    const entryId = String(item.sourceRefId);
    linkedItemsByEntryId[entryId] ??= [];
    linkedItemsByEntryId[entryId].push(toItemInput(item));
  }

  const entryInputs: ExamAssessmentLinkEntryInput[] = entryDocs.map((entry) =>
    toEntryInput(entry)
  );
  const missingLinks = listMissingAssessmentLinkEntries({
    entries: entryInputs,
    linkedItemsByEntryId,
  });

  const requiredEntryCount = entryInputs.filter((entry) => entry.contributesToReport).length;
  const completeEntryCount = requiredEntryCount - missingLinks.length;

  const readiness = buildPublishReadinessSummary({
    entries: entryDocs.map((entry) => ({
      id: String(entry._id),
      isUnscheduled: entry.isUnscheduled ?? false,
      status: entry.status,
    })),
    conflicts: conflictCheck.conflicts,
    missingAssessmentLinks: missingLinks,
    requiredEntryCount,
    completeEntryCount,
  });

  return {
    examSessionId: String(session._id),
    checkedAt: new Date().toISOString(),
    canPublish: readiness.canPublish,
    sessionStatus: session.status,
    currentVersionNumber: currentVersion?.versionNumber ?? null,
    summary: {
      entryCount: readiness.entryCount,
      scheduledEntryCount: readiness.scheduledEntryCount,
      unscheduledEntryCount: readiness.unscheduledEntryCount,
      blockingCount: readiness.blockingCount,
      warningCount: readiness.warningCount,
      infoCount: readiness.infoCount,
      missingAssessmentLinkCount: readiness.missingAssessmentLinkCount,
      readinessScore: readiness.readinessScore,
    },
    blockingIssues: readiness.blockingIssues,
    warnings: readiness.warnings,
    infoNotices: readiness.infoNotices,
    assessmentLinks: readiness.assessmentLinks,
    conflictSummary: readiness.conflictSummary,
  };
}
