import mongoose, { Types } from "mongoose";
import { z } from "zod";
import { EXAM_INVIGILATOR_ROLES } from "@/constants/academics/exam-scheduling-engine";
import { ExamInvigilatorAssignment, type IExamInvigilatorAssignment } from "@/models/ExamInvigilatorAssignment";
import { ExamSession, type IExamSession } from "@/models/ExamSession";
import { ExamTimetableEntry } from "@/models/ExamTimetableEntry";
import { Teacher } from "@/models/Teacher";
import type {
  ExamInvigilatorAssignmentDTO,
  ExamInvigilatorRole,
  ExamInvigilatorStatus,
  ExamSessionStatus,
} from "@/types/academics/exam-scheduling-engine";
import { resolveExamPolicyForSchool } from "@/lib/exams/exam-policy-service";
import {
  notifyExamInvigilatorAssigned,
  notifyExamInvigilatorReplaced,
} from "@/lib/exams/exam-notifications";

const objectIdSchema = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
  message: "Invalid ObjectId",
});

const assignInvigilatorBodySchema = z.object({
  examTimetableEntryId: objectIdSchema,
  teacherId: objectIdSchema,
  role: z.enum(EXAM_INVIGILATOR_ROLES).default("lead"),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const replaceInvigilatorBodySchema = z.object({
  teacherId: objectIdSchema,
  role: z.enum(EXAM_INVIGILATOR_ROLES).optional(),
  replacementReason: z.string().trim().max(1000).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export type AssignInvigilatorBodyInput = z.infer<typeof assignInvigilatorBodySchema>;
export type ReplaceInvigilatorBodyInput = z.infer<typeof replaceInvigilatorBodySchema>;

export class ExamInvigilatorServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExamInvigilatorServiceError";
    this.status = status;
  }
}

const MUTABLE_SESSION_STATUSES: ExamSessionStatus[] = [
  "draft",
  "scheduled",
  "conflict_review",
];

const ACTIVE_ASSIGNMENT_STATUSES: ExamInvigilatorStatus[] = ["assigned", "acknowledged"];

export function serializeExamInvigilatorAssignment(
  doc: IExamInvigilatorAssignment
): ExamInvigilatorAssignmentDTO {
  return {
    id: String(doc._id),
    schoolId: String(doc.schoolId),
    examSessionId: String(doc.examSessionId),
    examTimetableEntryId: String(doc.examTimetableEntryId),
    teacherId: String(doc.teacherId),
    role: doc.role,
    status: doc.status,
    assignedBy: String(doc.assignedBy),
    assignedAt: doc.assignedAt.toISOString(),
    acknowledgedAt: doc.acknowledgedAt ? doc.acknowledgedAt.toISOString() : null,
    declinedAt: doc.declinedAt ? doc.declinedAt.toISOString() : null,
    replacedByTeacherId: doc.replacedByTeacherId ? String(doc.replacedByTeacherId) : null,
    replacementReason: doc.replacementReason ?? null,
    notes: doc.notes ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function parseAssignInvigilatorBody(body: unknown) {
  const parsed = assignInvigilatorBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid request body.",
    };
  }
  return { ok: true as const, data: parsed.data };
}

export function parseReplaceInvigilatorBody(body: unknown) {
  const parsed = replaceInvigilatorBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid request body.",
    };
  }
  return { ok: true as const, data: parsed.data };
}

async function loadMutableExamSession(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
}): Promise<IExamSession> {
  if (!mongoose.Types.ObjectId.isValid(input.sessionId)) {
    throw new ExamInvigilatorServiceError("Invalid exam session id.", 400);
  }

  const session = await ExamSession.findOne({
    _id: input.sessionId,
    schoolId: input.schoolId,
  });

  if (!session) {
    throw new ExamInvigilatorServiceError("Exam session not found.", 404);
  }

  if (!MUTABLE_SESSION_STATUSES.includes(session.status)) {
    throw new ExamInvigilatorServiceError(
      "Invigilator assignments cannot be changed while the exam session is published or locked.",
      409
    );
  }

  return session;
}

async function loadEntryForSession(input: {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  entryId: string;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.entryId)) {
    throw new ExamInvigilatorServiceError("Invalid timetable entry id.", 400);
  }

  const entry = await ExamTimetableEntry.findOne({
    _id: input.entryId,
    examSessionId: input.sessionId,
    schoolId: input.schoolId,
  }).select("_id examSessionId");

  if (!entry) {
    throw new ExamInvigilatorServiceError("Exam timetable entry not found.", 404);
  }

  return entry;
}

async function loadTeacherForSchool(input: {
  schoolId: Types.ObjectId;
  teacherId: string;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.teacherId)) {
    throw new ExamInvigilatorServiceError("Invalid teacher id.", 400);
  }

  const teacher = await Teacher.findOne({
    _id: input.teacherId,
    schoolId: input.schoolId,
    status: { $in: ["active", "on_leave"] },
  }).select("_id");

  if (!teacher) {
    throw new ExamInvigilatorServiceError("Teacher not found for this school.", 404);
  }

  return teacher;
}

async function assertNoActiveDuplicateAssignment(input: {
  examTimetableEntryId: Types.ObjectId;
  teacherId: Types.ObjectId;
  excludeAssignmentId?: Types.ObjectId;
}) {
  const filter: Record<string, unknown> = {
    examTimetableEntryId: input.examTimetableEntryId,
    teacherId: input.teacherId,
    status: { $in: ACTIVE_ASSIGNMENT_STATUSES },
  };

  if (input.excludeAssignmentId) {
    filter._id = { $ne: input.excludeAssignmentId };
  }

  const existing = await ExamInvigilatorAssignment.findOne(filter).select("_id role");
  if (existing) {
    throw new ExamInvigilatorServiceError(
      "This teacher is already assigned to the selected exam paper.",
      409
    );
  }
}

export async function assignExamInvigilator(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  sessionId: string;
  body: AssignInvigilatorBodyInput;
}) {
  const session = await loadMutableExamSession({
    schoolId: input.schoolId,
    sessionId: input.sessionId,
  });

  await loadEntryForSession({
    schoolId: input.schoolId,
    sessionId: session._id,
    entryId: input.body.examTimetableEntryId,
  });

  const teacher = await loadTeacherForSchool({
    schoolId: input.schoolId,
    teacherId: input.body.teacherId,
  });

  await assertNoActiveDuplicateAssignment({
    examTimetableEntryId: new Types.ObjectId(input.body.examTimetableEntryId),
    teacherId: teacher._id,
  });

  try {
    const created = await ExamInvigilatorAssignment.create({
      schoolId: input.schoolId,
      examSessionId: session._id,
      examTimetableEntryId: input.body.examTimetableEntryId,
      teacherId: teacher._id,
      role: input.body.role,
      status: "assigned",
      assignedBy: input.actorId,
      assignedAt: new Date(),
      notes: input.body.notes ?? null,
    });

    const assignment = serializeExamInvigilatorAssignment(created);
    const policy = await resolveExamPolicyForSchool({
      schoolId: input.schoolId,
      policyId: session.policyId ?? null,
      actorId: input.actorId,
    });

    void notifyExamInvigilatorAssigned({
      schoolId: input.schoolId,
      sessionId: session._id as Types.ObjectId,
      assignment,
      requireTeacherAcknowledgement: policy.requireTeacherAcknowledgement,
    });

    return assignment;
  } catch (error) {
    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000
    ) {
      throw new ExamInvigilatorServiceError(
        "This teacher already has the same invigilation role on this exam paper.",
        409
      );
    }
    throw error;
  }
}

export async function listExamInvigilatorAssignments(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
  examTimetableEntryId?: string | null;
  teacherId?: string | null;
  status?: string | null;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.sessionId)) {
    throw new ExamInvigilatorServiceError("Invalid exam session id.", 400);
  }

  const session = await ExamSession.findOne({
    _id: input.sessionId,
    schoolId: input.schoolId,
  }).select("_id");

  if (!session) {
    throw new ExamInvigilatorServiceError("Exam session not found.", 404);
  }

  const filter: Record<string, unknown> = {
    schoolId: input.schoolId,
    examSessionId: input.sessionId,
  };

  if (input.examTimetableEntryId && mongoose.Types.ObjectId.isValid(input.examTimetableEntryId)) {
    filter.examTimetableEntryId = input.examTimetableEntryId;
  }

  if (input.teacherId && mongoose.Types.ObjectId.isValid(input.teacherId)) {
    filter.teacherId = input.teacherId;
  }

  if (input.status) {
    filter.status = input.status;
  }

  const rows = await ExamInvigilatorAssignment.find(filter).sort({
    assignedAt: -1,
    createdAt: -1,
  });

  return rows.map(serializeExamInvigilatorAssignment);
}

export async function getExamInvigilatorAssignmentById(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
  assignmentId: string;
}) {
  if (
    !mongoose.Types.ObjectId.isValid(input.sessionId) ||
    !mongoose.Types.ObjectId.isValid(input.assignmentId)
  ) {
    throw new ExamInvigilatorServiceError("Invalid id.", 400);
  }

  const assignment = await ExamInvigilatorAssignment.findOne({
    _id: input.assignmentId,
    examSessionId: input.sessionId,
    schoolId: input.schoolId,
  });

  if (!assignment) {
    throw new ExamInvigilatorServiceError("Invigilator assignment not found.", 404);
  }

  return serializeExamInvigilatorAssignment(assignment);
}

export async function removeExamInvigilatorAssignment(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
  assignmentId: string;
}) {
  await loadMutableExamSession({
    schoolId: input.schoolId,
    sessionId: input.sessionId,
  });

  if (!mongoose.Types.ObjectId.isValid(input.assignmentId)) {
    throw new ExamInvigilatorServiceError("Invalid assignment id.", 400);
  }

  const assignment = await ExamInvigilatorAssignment.findOne({
    _id: input.assignmentId,
    examSessionId: input.sessionId,
    schoolId: input.schoolId,
  });

  if (!assignment) {
    throw new ExamInvigilatorServiceError("Invigilator assignment not found.", 404);
  }

  if (!["assigned", "acknowledged", "declined"].includes(assignment.status)) {
    throw new ExamInvigilatorServiceError(
      "This invigilator assignment cannot be removed.",
      409
    );
  }

  await assignment.deleteOne();
  return { deleted: true, id: input.assignmentId };
}

export async function replaceExamInvigilatorAssignment(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  sessionId: string;
  assignmentId: string;
  body: ReplaceInvigilatorBodyInput;
}) {
  const session = await loadMutableExamSession({
    schoolId: input.schoolId,
    sessionId: input.sessionId,
  });

  if (!mongoose.Types.ObjectId.isValid(input.assignmentId)) {
    throw new ExamInvigilatorServiceError("Invalid assignment id.", 400);
  }

  const assignment = await ExamInvigilatorAssignment.findOne({
    _id: input.assignmentId,
    examSessionId: session._id,
    schoolId: input.schoolId,
  });

  if (!assignment) {
    throw new ExamInvigilatorServiceError("Invigilator assignment not found.", 404);
  }

  if (!ACTIVE_ASSIGNMENT_STATUSES.includes(assignment.status)) {
    throw new ExamInvigilatorServiceError(
      "Only active invigilator assignments can be replaced.",
      409
    );
  }

  const replacementTeacher = await loadTeacherForSchool({
    schoolId: input.schoolId,
    teacherId: input.body.teacherId,
  });

  if (String(replacementTeacher._id) === String(assignment.teacherId)) {
    throw new ExamInvigilatorServiceError(
      "Choose a different teacher to replace the current invigilator.",
      400
    );
  }

  await assertNoActiveDuplicateAssignment({
    examTimetableEntryId: assignment.examTimetableEntryId,
    teacherId: replacementTeacher._id,
    excludeAssignmentId: assignment._id,
  });

  const nextRole: ExamInvigilatorRole = input.body.role ?? assignment.role;

  assignment.status = "replaced";
  assignment.replacedByTeacherId = replacementTeacher._id;
  assignment.replacementReason = input.body.replacementReason ?? null;
  await assignment.save();

  try {
    const created = await ExamInvigilatorAssignment.create({
      schoolId: input.schoolId,
      examSessionId: session._id,
      examTimetableEntryId: assignment.examTimetableEntryId,
      teacherId: replacementTeacher._id,
      role: nextRole,
      status: "assigned",
      assignedBy: input.actorId,
      assignedAt: new Date(),
      notes: input.body.notes ?? null,
    });

    const policy = await resolveExamPolicyForSchool({
      schoolId: input.schoolId,
      policyId: session.policyId ?? null,
      actorId: input.actorId,
    });

    const replacementAssignment = serializeExamInvigilatorAssignment(created);

    void notifyExamInvigilatorReplaced({
      schoolId: input.schoolId,
      sessionId: session._id as Types.ObjectId,
      previousTeacherId: assignment.teacherId as Types.ObjectId,
      replacementAssignment,
      requireTeacherAcknowledgement: policy.requireTeacherAcknowledgement,
    });

    return {
      replaced: serializeExamInvigilatorAssignment(assignment),
      assignment: replacementAssignment,
    };
  } catch (error) {
    assignment.status = "assigned";
    assignment.replacedByTeacherId = null;
    assignment.replacementReason = null;
    await assignment.save();

    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000
    ) {
      throw new ExamInvigilatorServiceError(
        "Replacement teacher already has the same invigilation role on this exam paper.",
        409
      );
    }
    throw error;
  }
}

export async function acknowledgeExamInvigilatorAssignment(input: {
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  assignmentId: string;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.assignmentId)) {
    throw new ExamInvigilatorServiceError("Invalid assignment id.", 400);
  }

  const assignment = await ExamInvigilatorAssignment.findOne({
    _id: input.assignmentId,
    schoolId: input.schoolId,
    teacherId: input.teacherId,
  });

  if (!assignment) {
    throw new ExamInvigilatorServiceError("Invigilator assignment not found.", 404);
  }

  if (assignment.status !== "assigned") {
    throw new ExamInvigilatorServiceError(
      "Only newly assigned duties can be acknowledged.",
      409
    );
  }

  assignment.status = "acknowledged";
  assignment.acknowledgedAt = new Date();
  await assignment.save();

  return serializeExamInvigilatorAssignment(assignment);
}
