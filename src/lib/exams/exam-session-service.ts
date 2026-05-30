import mongoose, { Types } from "mongoose";
import { z } from "zod";
import {
  EXAM_SESSION_STATUSES,
  EXAM_TYPES,
} from "@/constants/academics/exam-scheduling-engine";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { AssessmentPlan } from "@/models/AssessmentPlan";
import { AcademicGradingPolicy } from "@/models/AcademicGradingPolicy";
import { ClassGroup } from "@/models/ClassGroup";
import { ExamSession, type IExamSession } from "@/models/ExamSession";
import { Grade } from "@/models/Grade";
import { Subject } from "@/models/Subject";
import {
  ensureDefaultExamPolicyForSchool,
  resolveExamPolicyForSchool,
} from "@/lib/exams/exam-policy-service";
import type { ExamSessionDTO, ExamSessionStatus } from "@/types/academics/exam-scheduling-engine";

const objectIdSchema = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
  message: "Invalid ObjectId",
});

const objectIdListSchema = z.array(objectIdSchema).default([]);

const dateInputSchema = z.union([
  z.string().datetime(),
  z.string().date(),
  z.coerce.date(),
]);

const createExamSessionBodySchema = z.object({
  name: z.string().trim().min(1).max(300),
  code: z.string().trim().max(80).nullable().optional(),
  examType: z.enum(EXAM_TYPES),
  academicPeriodId: objectIdSchema,
  academicYearId: objectIdSchema.nullable().optional(),
  startDate: dateInputSchema,
  endDate: dateInputSchema,
  appliesToGradeIds: objectIdListSchema.optional(),
  appliesToClassGroupIds: objectIdListSchema.optional(),
  appliesToSubjectIds: objectIdListSchema.optional(),
  policyId: objectIdSchema.nullable().optional(),
  assessmentPlanId: objectIdSchema.nullable().optional(),
  gradingPolicyId: objectIdSchema.nullable().optional(),
  allowParentStudentVisibility: z.boolean().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
});

const updateExamSessionBodySchema = createExamSessionBodySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export type CreateExamSessionBodyInput = z.infer<typeof createExamSessionBodySchema>;
export type UpdateExamSessionBodyInput = z.infer<typeof updateExamSessionBodySchema>;

export class ExamSessionServiceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExamSessionServiceError";
    this.status = status;
  }
}

const EDITABLE_SESSION_STATUSES: ExamSessionStatus[] = ["draft", "scheduled"];

export function serializeExamSession(doc: IExamSession): ExamSessionDTO {
  return {
    id: String(doc._id),
    schoolId: String(doc.schoolId),
    academicYearId: doc.academicYearId ? String(doc.academicYearId) : null,
    academicPeriodId: String(doc.academicPeriodId),
    name: doc.name,
    code: doc.code ?? null,
    examType: doc.examType,
    startDate: doc.startDate.toISOString(),
    endDate: doc.endDate.toISOString(),
    appliesToGradeIds: (doc.appliesToGradeIds ?? []).map(String),
    appliesToClassGroupIds: (doc.appliesToClassGroupIds ?? []).map(String),
    appliesToSubjectIds: (doc.appliesToSubjectIds ?? []).map(String),
    status: doc.status,
    policyId: doc.policyId ? String(doc.policyId) : null,
    assessmentPlanId: doc.assessmentPlanId ? String(doc.assessmentPlanId) : null,
    gradingPolicyId: doc.gradingPolicyId ? String(doc.gradingPolicyId) : null,
    allowParentStudentVisibility: doc.allowParentStudentVisibility,
    publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
    publishedBy: doc.publishedBy ? String(doc.publishedBy) : null,
    lockedAt: doc.lockedAt ? doc.lockedAt.toISOString() : null,
    lockedBy: doc.lockedBy ? String(doc.lockedBy) : null,
    notes: doc.notes ?? null,
    createdBy: String(doc.createdBy),
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function parseDate(value: z.infer<typeof dateInputSchema>): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ExamSessionServiceError("Invalid date value.");
  }
  return date;
}

function toObjectIds(values: string[]): Types.ObjectId[] {
  return values.map((value) => new Types.ObjectId(value));
}

async function validateExamSessionReferences(input: {
  schoolId: Types.ObjectId;
  academicPeriodId: string;
  academicYearId?: string | null;
  appliesToGradeIds?: string[];
  appliesToClassGroupIds?: string[];
  appliesToSubjectIds?: string[];
  policyId?: string | null;
  assessmentPlanId?: string | null;
  gradingPolicyId?: string | null;
  actorId: Types.ObjectId;
}) {
  const period = await AcademicPeriod.findOne({
    _id: input.academicPeriodId,
    schoolId: input.schoolId,
  }).select("_id startDate endDate");

  if (!period) {
    throw new ExamSessionServiceError("Academic period not found for this school.", 404);
  }

  if (input.gradingPolicyId) {
    const gradingPolicy = await AcademicGradingPolicy.findOne({
      _id: input.gradingPolicyId,
      schoolId: input.schoolId,
    }).select("_id");
    if (!gradingPolicy) {
      throw new ExamSessionServiceError("Grading policy not found for this school.", 404);
    }
  }

  if (input.assessmentPlanId) {
    const assessmentPlan = await AssessmentPlan.findOne({
      _id: input.assessmentPlanId,
      schoolId: input.schoolId,
      academicPeriodId: input.academicPeriodId,
    }).select("_id");
    if (!assessmentPlan) {
      throw new ExamSessionServiceError(
        "Assessment plan not found for this school and academic period.",
        404
      );
    }
  }

  const gradeIds = input.appliesToGradeIds ?? [];
  if (gradeIds.length > 0) {
    const count = await Grade.countDocuments({
      _id: { $in: toObjectIds(gradeIds) },
      schoolId: input.schoolId,
    });
    if (count !== gradeIds.length) {
      throw new ExamSessionServiceError("One or more grades are invalid for this school.", 400);
    }
  }

  const classGroupIds = input.appliesToClassGroupIds ?? [];
  if (classGroupIds.length > 0) {
    const count = await ClassGroup.countDocuments({
      _id: { $in: toObjectIds(classGroupIds) },
      schoolId: input.schoolId,
    });
    if (count !== classGroupIds.length) {
      throw new ExamSessionServiceError(
        "One or more class groups are invalid for this school.",
        400
      );
    }
  }

  const subjectIds = input.appliesToSubjectIds ?? [];
  if (subjectIds.length > 0) {
    const count = await Subject.countDocuments({
      _id: { $in: toObjectIds(subjectIds) },
      schoolId: input.schoolId,
    });
    if (count !== subjectIds.length) {
      throw new ExamSessionServiceError("One or more subjects are invalid for this school.", 400);
    }
  }

  const policy = await resolveExamPolicyForSchool({
    schoolId: input.schoolId,
    policyId: input.policyId,
    actorId: input.actorId,
  });

  return { period, policy };
}

export function parseCreateExamSessionBody(body: unknown) {
  const parsed = createExamSessionBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid request body.",
    };
  }
  return { ok: true as const, data: parsed.data };
}

export function parseUpdateExamSessionBody(body: unknown) {
  const parsed = updateExamSessionBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid request body.",
    };
  }
  return { ok: true as const, data: parsed.data };
}

export async function createExamSession(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  body: z.infer<typeof createExamSessionBodySchema>;
}) {
  const startDate = parseDate(input.body.startDate);
  const endDate = parseDate(input.body.endDate);
  if (endDate < startDate) {
    throw new ExamSessionServiceError("End date must be on or after start date.");
  }

  const { policy } = await validateExamSessionReferences({
    schoolId: input.schoolId,
    academicPeriodId: input.body.academicPeriodId,
    academicYearId: input.body.academicYearId,
    appliesToGradeIds: input.body.appliesToGradeIds,
    appliesToClassGroupIds: input.body.appliesToClassGroupIds,
    appliesToSubjectIds: input.body.appliesToSubjectIds,
    policyId: input.body.policyId,
    assessmentPlanId: input.body.assessmentPlanId,
    gradingPolicyId: input.body.gradingPolicyId,
    actorId: input.actorId,
  });

  await ensureDefaultExamPolicyForSchool({
    schoolId: input.schoolId,
    actorId: input.actorId,
  });

  const created = await ExamSession.create({
    schoolId: input.schoolId,
    academicPeriodId: input.body.academicPeriodId,
    academicYearId: input.body.academicYearId ?? null,
    name: input.body.name,
    code: input.body.code ?? null,
    examType: input.body.examType,
    startDate,
    endDate,
    appliesToGradeIds: toObjectIds(input.body.appliesToGradeIds ?? []),
    appliesToClassGroupIds: toObjectIds(input.body.appliesToClassGroupIds ?? []),
    appliesToSubjectIds: toObjectIds(input.body.appliesToSubjectIds ?? []),
    status: "draft",
    policyId: input.body.policyId ? input.body.policyId : policy._id,
    assessmentPlanId: input.body.assessmentPlanId ?? null,
    gradingPolicyId: input.body.gradingPolicyId ?? null,
    allowParentStudentVisibility: input.body.allowParentStudentVisibility ?? true,
    notes: input.body.notes ?? null,
    createdBy: input.actorId,
    updatedBy: input.actorId,
  });

  return serializeExamSession(created);
}

export async function listExamSessions(input: {
  schoolId: Types.ObjectId;
  status?: string | null;
  academicPeriodId?: string | null;
}) {
  const filter: Record<string, unknown> = { schoolId: input.schoolId };

  if (input.status && EXAM_SESSION_STATUSES.includes(input.status as ExamSessionStatus)) {
    filter.status = input.status;
  }

  if (input.academicPeriodId && mongoose.Types.ObjectId.isValid(input.academicPeriodId)) {
    filter.academicPeriodId = input.academicPeriodId;
  }

  const rows = await ExamSession.find(filter).sort({ startDate: -1, createdAt: -1 });
  return rows.map(serializeExamSession);
}

export async function getExamSessionById(input: {
  schoolId: Types.ObjectId;
  sessionId: string;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.sessionId)) {
    throw new ExamSessionServiceError("Invalid exam session id.", 400);
  }

  const session = await ExamSession.findOne({
    _id: input.sessionId,
    schoolId: input.schoolId,
  });

  if (!session) {
    throw new ExamSessionServiceError("Exam session not found.", 404);
  }

  return serializeExamSession(session);
}

export async function updateExamSession(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  sessionId: string;
  body: z.infer<typeof updateExamSessionBodySchema>;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.sessionId)) {
    throw new ExamSessionServiceError("Invalid exam session id.", 400);
  }

  const session = await ExamSession.findOne({
    _id: input.sessionId,
    schoolId: input.schoolId,
  });

  if (!session) {
    throw new ExamSessionServiceError("Exam session not found.", 404);
  }

  if (!EDITABLE_SESSION_STATUSES.includes(session.status)) {
    throw new ExamSessionServiceError(
      "Only draft or scheduled exam sessions can be edited.",
      409
    );
  }

  const nextAcademicPeriodId =
    input.body.academicPeriodId ?? String(session.academicPeriodId);

  await validateExamSessionReferences({
    schoolId: input.schoolId,
    academicPeriodId: nextAcademicPeriodId,
    academicYearId: input.body.academicYearId,
    appliesToGradeIds: input.body.appliesToGradeIds,
    appliesToClassGroupIds: input.body.appliesToClassGroupIds,
    appliesToSubjectIds: input.body.appliesToSubjectIds,
    policyId: input.body.policyId,
    assessmentPlanId: input.body.assessmentPlanId,
    gradingPolicyId: input.body.gradingPolicyId,
    actorId: input.actorId,
  });

  if (input.body.name !== undefined) session.name = input.body.name;
  if (input.body.code !== undefined) session.code = input.body.code;
  if (input.body.examType !== undefined) session.examType = input.body.examType;
  if (input.body.academicPeriodId !== undefined) {
    session.academicPeriodId = new Types.ObjectId(input.body.academicPeriodId);
  }
  if (input.body.academicYearId !== undefined) {
    session.academicYearId = input.body.academicYearId
      ? new Types.ObjectId(input.body.academicYearId)
      : null;
  }
  if (input.body.startDate !== undefined) {
    session.startDate = parseDate(input.body.startDate);
  }
  if (input.body.endDate !== undefined) {
    session.endDate = parseDate(input.body.endDate);
  }
  if (session.endDate < session.startDate) {
    throw new ExamSessionServiceError("End date must be on or after start date.");
  }
  if (input.body.appliesToGradeIds !== undefined) {
    session.appliesToGradeIds = toObjectIds(input.body.appliesToGradeIds);
  }
  if (input.body.appliesToClassGroupIds !== undefined) {
    session.appliesToClassGroupIds = toObjectIds(input.body.appliesToClassGroupIds);
  }
  if (input.body.appliesToSubjectIds !== undefined) {
    session.appliesToSubjectIds = toObjectIds(input.body.appliesToSubjectIds);
  }
  if (input.body.policyId !== undefined) {
    session.policyId = input.body.policyId
      ? new Types.ObjectId(input.body.policyId)
      : null;
  }
  if (input.body.assessmentPlanId !== undefined) {
    session.assessmentPlanId = input.body.assessmentPlanId
      ? new Types.ObjectId(input.body.assessmentPlanId)
      : null;
  }
  if (input.body.gradingPolicyId !== undefined) {
    session.gradingPolicyId = input.body.gradingPolicyId
      ? new Types.ObjectId(input.body.gradingPolicyId)
      : null;
  }
  if (input.body.allowParentStudentVisibility !== undefined) {
    session.allowParentStudentVisibility = input.body.allowParentStudentVisibility;
  }
  if (input.body.notes !== undefined) session.notes = input.body.notes;

  session.updatedBy = input.actorId;
  await session.save();

  return serializeExamSession(session);
}

export async function cancelExamSession(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
  sessionId: string;
}) {
  if (!mongoose.Types.ObjectId.isValid(input.sessionId)) {
    throw new ExamSessionServiceError("Invalid exam session id.", 400);
  }

  const session = await ExamSession.findOne({
    _id: input.sessionId,
    schoolId: input.schoolId,
  });

  if (!session) {
    throw new ExamSessionServiceError("Exam session not found.", 404);
  }

  if (["locked", "archived", "cancelled"].includes(session.status)) {
    throw new ExamSessionServiceError(
      `Exam session cannot be cancelled while ${session.status}.`,
      409
    );
  }

  session.status = "cancelled";
  session.updatedBy = input.actorId;
  await session.save();

  return serializeExamSession(session);
}
