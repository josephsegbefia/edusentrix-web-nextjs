import { Types } from "mongoose";
import { recordActivity } from "@/lib/audit/recordActivity";

export async function recordExamEntryStarted(input: {
  schoolId: Types.ObjectId;
  actorUserId: Types.ObjectId;
  teacherId: Types.ObjectId;
  examSessionId: Types.ObjectId;
  examTimetableEntryId: Types.ObjectId;
}) {
  await recordActivity({
    schoolId: input.schoolId,
    userId: input.actorUserId,
    type: "exam.entry.started",
    entityType: "ExamTimetableEntry",
    entityId: input.examTimetableEntryId,
    description: "Exam paper marked as started.",
    metadata: {
      examSessionId: String(input.examSessionId),
      teacherId: String(input.teacherId),
    },
  });
}

export async function recordExamEntryCompleted(input: {
  schoolId: Types.ObjectId;
  actorUserId: Types.ObjectId;
  teacherId: Types.ObjectId;
  examSessionId: Types.ObjectId;
  examTimetableEntryId: Types.ObjectId;
}) {
  await recordActivity({
    schoolId: input.schoolId,
    userId: input.actorUserId,
    type: "exam.entry.completed",
    entityType: "ExamTimetableEntry",
    entityId: input.examTimetableEntryId,
    description: "Exam paper marked as completed.",
    metadata: {
      examSessionId: String(input.examSessionId),
      teacherId: String(input.teacherId),
    },
  });
}

export async function recordExamIncidentReported(input: {
  schoolId: Types.ObjectId;
  actorUserId: Types.ObjectId;
  teacherId: Types.ObjectId;
  examSessionId: Types.ObjectId;
  examTimetableEntryId: Types.ObjectId;
  incidentId: Types.ObjectId;
  incidentType: string;
  severity: string;
}) {
  await recordActivity({
    schoolId: input.schoolId,
    userId: input.actorUserId,
    type: "exam.incident.reported",
    entityType: "ExamIncidentReport",
    entityId: input.incidentId,
    description: "Exam incident reported.",
    metadata: {
      examSessionId: String(input.examSessionId),
      examTimetableEntryId: String(input.examTimetableEntryId),
      teacherId: String(input.teacherId),
      incidentType: input.incidentType,
      severity: input.severity,
    },
  });
}

export async function recordExamSittingStatusRecorded(input: {
  schoolId: Types.ObjectId;
  actorUserId: Types.ObjectId;
  teacherId: Types.ObjectId;
  examSessionId: Types.ObjectId;
  examTimetableEntryId: Types.ObjectId;
  sittingStatusId: Types.ObjectId;
  studentId: Types.ObjectId;
  status: string;
}) {
  await recordActivity({
    schoolId: input.schoolId,
    userId: input.actorUserId,
    type: "exam.sitting.recorded",
    entityType: "ExamStudentSittingStatus",
    entityId: input.sittingStatusId,
    description: "Exam sitting status recorded.",
    metadata: {
      examSessionId: String(input.examSessionId),
      examTimetableEntryId: String(input.examTimetableEntryId),
      teacherId: String(input.teacherId),
      studentId: String(input.studentId),
      status: input.status,
    },
  });
}
