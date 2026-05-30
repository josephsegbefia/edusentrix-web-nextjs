import mongoose, { Types } from "mongoose";
import { z } from "zod";
import {
  EXAM_INCIDENT_SEVERITIES,
  EXAM_INCIDENT_TYPES,
  EXAM_STUDENT_SITTING_STATUSES,
} from "@/constants/academics/exam-scheduling-engine";
import { ExamIncidentReport, type IExamIncidentReport } from "@/models/ExamIncidentReport";
import { ExamInvigilatorAssignment } from "@/models/ExamInvigilatorAssignment";
import { ExamSession } from "@/models/ExamSession";
import { ExamStudentSittingStatus, type IExamStudentSittingStatus } from "@/models/ExamStudentSittingStatus";
import { ExamTimetableEntry, type IExamTimetableEntry } from "@/models/ExamTimetableEntry";
import type {
  ExamIncidentReportDTO,
  ExamStudentSittingStatusDTO,
  ExamTimetableEntryStatus,
  TeacherExamDayOpsDTO,
} from "@/types/academics/exam-scheduling-engine";
import {
  recordExamEntryCompleted,
  recordExamEntryStarted,
  recordExamIncidentReported,
  recordExamSittingStatusRecorded,
} from "@/lib/exams/exam-day-audit";
import {
  canMarkExamEntryCompleted,
  canMarkExamEntryStarted,
  isExamDayOperationSessionStatus,
  resolveNextEntryStatusAfterComplete,
  resolveNextEntryStatusAfterStart,
} from "@/lib/exams/exam-day-validation";

const ACTIVE_INVIGILATOR_STATUSES = ["assigned", "acknowledged"] as const;

const reportIncidentBodySchema = z.object({
  type: z.enum(EXAM_INCIDENT_TYPES),
  severity: z.enum(EXAM_INCIDENT_SEVERITIES).default("medium"),
  description: z.string().trim().min(1).max(5000),
  actionTaken: z.string().trim().max(2000).nullable().optional(),
});

const recordSittingStatusBodySchema = z.object({
  studentId: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: "Invalid student id",
  }),
  status: z.enum(EXAM_STUDENT_SITTING_STATUSES),
  note: z.string().trim().max(1000).nullable().optional(),
});

export type ReportExamIncidentBodyInput = z.infer<typeof reportIncidentBodySchema>;
export type RecordExamSittingStatusBodyInput = z.infer<typeof recordSittingStatusBodySchema>;

export class ExamDayOperationsServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExamDayOperationsServiceError";
    this.status = status;
  }
}

export function serializeExamIncidentReport(doc: IExamIncidentReport): ExamIncidentReportDTO {
  return {
    id: String(doc._id),
    schoolId: String(doc.schoolId),
    examSessionId: String(doc.examSessionId),
    examTimetableEntryId: String(doc.examTimetableEntryId),
    reportedBy: String(doc.reportedBy),
    type: doc.type,
    severity: doc.severity,
    description: doc.description,
    actionTaken: doc.actionTaken ?? null,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function serializeExamStudentSittingStatus(
  doc: IExamStudentSittingStatus
): ExamStudentSittingStatusDTO {
  return {
    id: String(doc._id),
    schoolId: String(doc.schoolId),
    examSessionId: String(doc.examSessionId),
    examTimetableEntryId: String(doc.examTimetableEntryId),
    studentId: String(doc.studentId),
    status: doc.status,
    recordedBy: String(doc.recordedBy),
    recordedAt: doc.recordedAt.toISOString(),
    note: doc.note ?? null,
  };
}

export function parseReportExamIncidentBody(body: unknown) {
  const parsed = reportIncidentBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid request body.",
    };
  }
  return { ok: true as const, data: parsed.data };
}

export function parseRecordExamSittingStatusBody(body: unknown) {
  const parsed = recordSittingStatusBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid request body.",
    };
  }
  return { ok: true as const, data: parsed.data };
}

async function assertTeacherCanOperateEntry(input: {
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  entryId: string;
}): Promise<{
  entry: IExamTimetableEntry;
  sessionStatus: string;
}> {
  if (!mongoose.Types.ObjectId.isValid(input.entryId)) {
    throw new ExamDayOperationsServiceError("Invalid exam entry id.", 400);
  }

  const entry = await ExamTimetableEntry.findOne({
    _id: input.entryId,
    schoolId: input.schoolId,
  });

  if (!entry) {
    throw new ExamDayOperationsServiceError("Exam entry not found.", 404);
  }

  const session = await ExamSession.findOne({
    _id: entry.examSessionId,
    schoolId: input.schoolId,
  }).select("status");

  if (!session) {
    throw new ExamDayOperationsServiceError("Exam session not found.", 404);
  }

  if (!isExamDayOperationSessionStatus(session.status)) {
    throw new ExamDayOperationsServiceError(
      "Exam day operations are only available for published exam sessions.",
      409
    );
  }

  const assignment = await ExamInvigilatorAssignment.findOne({
    schoolId: input.schoolId,
    examTimetableEntryId: entry._id,
    teacherId: input.teacherId,
    status: { $in: ACTIVE_INVIGILATOR_STATUSES },
  }).select("_id");

  if (!assignment) {
    throw new ExamDayOperationsServiceError(
      "Only assigned invigilators can perform exam day operations on this paper.",
      403
    );
  }

  return { entry, sessionStatus: session.status };
}

export function buildTeacherExamDayOps(entryStatus: ExamTimetableEntryStatus): TeacherExamDayOpsDTO {
  return {
    entryId: "",
    entryStatus,
    canMarkStarted: canMarkExamEntryStarted(entryStatus),
    canMarkCompleted: canMarkExamEntryCompleted(entryStatus),
    canReportIncident: entryStatus !== "cancelled" && entryStatus !== "rescheduled",
  };
}

export async function getTeacherExamDayOps(input: {
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  entryId: string;
}): Promise<TeacherExamDayOpsDTO> {
  const { entry } = await assertTeacherCanOperateEntry(input);
  return {
    ...buildTeacherExamDayOps(entry.status),
    entryId: String(entry._id),
  };
}

export async function markExamEntryStarted(input: {
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  actorUserId: Types.ObjectId;
  entryId: string;
}) {
  const { entry } = await assertTeacherCanOperateEntry(input);
  const nextStatus = resolveNextEntryStatusAfterStart(entry.status);

  if (!nextStatus) {
    throw new ExamDayOperationsServiceError(
      "This exam paper cannot be marked as started in its current state.",
      409
    );
  }

  entry.status = nextStatus;
  entry.updatedBy = input.actorUserId;
  await entry.save();

  await ExamSession.updateOne(
    { _id: entry.examSessionId, schoolId: input.schoolId, status: "published" },
    { $set: { status: "in_progress", updatedBy: input.actorUserId } }
  );

  await ExamInvigilatorAssignment.updateMany(
    {
      schoolId: input.schoolId,
      examTimetableEntryId: entry._id,
      teacherId: input.teacherId,
      status: { $in: ACTIVE_INVIGILATOR_STATUSES },
    },
    { $set: { status: "acknowledged" } }
  );

  void recordExamEntryStarted({
    schoolId: input.schoolId,
    actorUserId: input.actorUserId,
    teacherId: input.teacherId,
    examSessionId: entry.examSessionId as Types.ObjectId,
    examTimetableEntryId: entry._id as Types.ObjectId,
  });

  return {
    entryId: String(entry._id),
    status: entry.status,
    dayOps: buildTeacherExamDayOps(entry.status),
  };
}

export async function markExamEntryCompleted(input: {
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  actorUserId: Types.ObjectId;
  entryId: string;
}) {
  const { entry } = await assertTeacherCanOperateEntry(input);
  const nextStatus = resolveNextEntryStatusAfterComplete(entry.status);

  if (!nextStatus) {
    throw new ExamDayOperationsServiceError(
      "This exam paper cannot be marked as completed in its current state.",
      409
    );
  }

  entry.status = nextStatus;
  entry.updatedBy = input.actorUserId;
  await entry.save();

  await ExamInvigilatorAssignment.updateMany(
    {
      schoolId: input.schoolId,
      examTimetableEntryId: entry._id,
      teacherId: input.teacherId,
      status: { $in: ["assigned", "acknowledged", "completed"] },
    },
    { $set: { status: "completed" } }
  );

  void recordExamEntryCompleted({
    schoolId: input.schoolId,
    actorUserId: input.actorUserId,
    teacherId: input.teacherId,
    examSessionId: entry.examSessionId as Types.ObjectId,
    examTimetableEntryId: entry._id as Types.ObjectId,
  });

  return {
    entryId: String(entry._id),
    status: entry.status,
    dayOps: buildTeacherExamDayOps(entry.status),
  };
}

export async function reportExamIncident(input: {
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  actorUserId: Types.ObjectId;
  entryId: string;
  body: ReportExamIncidentBodyInput;
}) {
  const { entry } = await assertTeacherCanOperateEntry(input);

  const created = await ExamIncidentReport.create({
    schoolId: input.schoolId,
    examSessionId: entry.examSessionId,
    examTimetableEntryId: entry._id,
    reportedBy: input.actorUserId,
    type: input.body.type,
    severity: input.body.severity,
    description: input.body.description,
    actionTaken: input.body.actionTaken ?? null,
    status: "open",
  });

  void recordExamIncidentReported({
    schoolId: input.schoolId,
    actorUserId: input.actorUserId,
    teacherId: input.teacherId,
    examSessionId: entry.examSessionId as Types.ObjectId,
    examTimetableEntryId: entry._id as Types.ObjectId,
    incidentId: created._id as Types.ObjectId,
    incidentType: input.body.type,
    severity: input.body.severity,
  });

  return serializeExamIncidentReport(created);
}

/** Stub for future exam sitting capture UI. Persists one student sitting status. */
export async function recordExamStudentSittingStatusStub(input: {
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  actorUserId: Types.ObjectId;
  entryId: string;
  body: RecordExamSittingStatusBodyInput;
}) {
  const { entry } = await assertTeacherCanOperateEntry(input);

  const existing = await ExamStudentSittingStatus.findOne({
    schoolId: input.schoolId,
    examTimetableEntryId: entry._id,
    studentId: input.body.studentId,
  });

  const recordedAt = new Date();
  const doc = existing
    ? await ExamStudentSittingStatus.findOneAndUpdate(
        { _id: existing._id },
        {
          $set: {
            status: input.body.status,
            recordedBy: input.actorUserId,
            recordedAt,
            note: input.body.note ?? null,
          },
        },
        { new: true }
      )
    : await ExamStudentSittingStatus.create({
        schoolId: input.schoolId,
        examSessionId: entry.examSessionId,
        examTimetableEntryId: entry._id,
        studentId: input.body.studentId,
        status: input.body.status,
        recordedBy: input.actorUserId,
        recordedAt,
        note: input.body.note ?? null,
      });

  if (!doc) {
    throw new ExamDayOperationsServiceError("Failed to record sitting status.", 500);
  }

  void recordExamSittingStatusRecorded({
    schoolId: input.schoolId,
    actorUserId: input.actorUserId,
    teacherId: input.teacherId,
    examSessionId: entry.examSessionId as Types.ObjectId,
    examTimetableEntryId: entry._id as Types.ObjectId,
    sittingStatusId: doc._id as Types.ObjectId,
    studentId: new Types.ObjectId(input.body.studentId),
    status: input.body.status,
  });

  return serializeExamStudentSittingStatus(doc);
}
