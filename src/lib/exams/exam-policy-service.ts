import mongoose, { Types } from "mongoose";
import { DEFAULT_EXAM_POLICY_NAME } from "@/constants/academics/exam-scheduling-engine";
import { ExamPolicy, type IExamPolicy } from "@/models/ExamPolicy";
import type { ExamPolicyDTO } from "@/types/academics/exam-scheduling-engine";

export function buildDefaultExamPolicyFields(
  createdBy: Types.ObjectId
): Omit<IExamPolicy, "_id" | "schoolId" | "createdAt" | "updatedAt"> {
  return {
    name: DEFAULT_EXAM_POLICY_NAME,
    isDefault: true,
    requireVenue: true,
    requireInvigilator: true,
    requireTeacherAcknowledgement: false,
    allowSubjectTeacherInvigilation: false,
    maxInvigilationSessionsPerTeacherPerDay: null,
    maxInvigilationSessionsPerTeacherPerSession: null,
    maxExamsPerClassPerDay: null,
    minBreakMinutesBetweenExams: null,
    preventRoomDoubleBooking: true,
    preventClassExamOverlap: true,
    preventTeacherInvigilationOverlap: true,
    preventHolidayScheduling: true,
    coreSubjectsMorningPreference: false,
    allowConflictOverride: true,
    requireOverrideReason: true,
    createdBy,
    updatedBy: null,
  };
}

export function serializeExamPolicy(doc: IExamPolicy): ExamPolicyDTO {
  return {
    id: String(doc._id),
    schoolId: String(doc.schoolId),
    name: doc.name,
    isDefault: doc.isDefault,
    requireVenue: doc.requireVenue,
    requireInvigilator: doc.requireInvigilator,
    requireTeacherAcknowledgement: doc.requireTeacherAcknowledgement,
    allowSubjectTeacherInvigilation: doc.allowSubjectTeacherInvigilation,
    maxInvigilationSessionsPerTeacherPerDay:
      doc.maxInvigilationSessionsPerTeacherPerDay ?? null,
    maxInvigilationSessionsPerTeacherPerSession:
      doc.maxInvigilationSessionsPerTeacherPerSession ?? null,
    maxExamsPerClassPerDay: doc.maxExamsPerClassPerDay ?? null,
    minBreakMinutesBetweenExams: doc.minBreakMinutesBetweenExams ?? null,
    preventRoomDoubleBooking: doc.preventRoomDoubleBooking,
    preventClassExamOverlap: doc.preventClassExamOverlap,
    preventTeacherInvigilationOverlap: doc.preventTeacherInvigilationOverlap,
    preventHolidayScheduling: doc.preventHolidayScheduling,
    coreSubjectsMorningPreference: doc.coreSubjectsMorningPreference ?? false,
    allowConflictOverride: doc.allowConflictOverride,
    requireOverrideReason: doc.requireOverrideReason,
    createdBy: String(doc.createdBy),
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function ensureDefaultExamPolicyForSchool(input: {
  schoolId: Types.ObjectId;
  actorId: Types.ObjectId;
}): Promise<IExamPolicy> {
  const existing = await ExamPolicy.findOne({
    schoolId: input.schoolId,
    isDefault: true,
  });
  if (existing) return existing;

  try {
    return await ExamPolicy.create({
      schoolId: input.schoolId,
      ...buildDefaultExamPolicyFields(input.actorId),
    });
  } catch (error) {
    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000
    ) {
      const raced = await ExamPolicy.findOne({
        schoolId: input.schoolId,
        isDefault: true,
      });
      if (raced) return raced;
    }
    throw error;
  }
}

export async function resolveExamPolicyForSchool(input: {
  schoolId: Types.ObjectId;
  policyId?: Types.ObjectId | string | null;
  actorId: Types.ObjectId;
}): Promise<IExamPolicy> {
  if (input.policyId && mongoose.Types.ObjectId.isValid(String(input.policyId))) {
    const policy = await ExamPolicy.findOne({
      _id: input.policyId,
      schoolId: input.schoolId,
    });
    if (policy) return policy;
  }

  return ensureDefaultExamPolicyForSchool({
    schoolId: input.schoolId,
    actorId: input.actorId,
  });
}

export async function getExamPolicyById(input: {
  schoolId: Types.ObjectId;
  policyId: Types.ObjectId | string;
}): Promise<IExamPolicy | null> {
  if (!mongoose.Types.ObjectId.isValid(String(input.policyId))) {
    return null;
  }

  return ExamPolicy.findOne({
    _id: input.policyId,
    schoolId: input.schoolId,
  });
}

export async function listExamPoliciesForSchool(
  schoolId: Types.ObjectId
): Promise<IExamPolicy[]> {
  return ExamPolicy.find({ schoolId }).sort({ isDefault: -1, name: 1 });
}
