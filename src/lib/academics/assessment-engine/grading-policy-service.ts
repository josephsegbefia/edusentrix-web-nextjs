import mongoose from "mongoose";
import {
  GRADE_LABEL_MODES,
  ROUNDING_RULES,
} from "@/constants/academics/assessment-engine";
import { Grade } from "@/models/Grade";
import {
  AcademicGradingPolicy,
  type IAcademicGradingPolicy,
} from "@/models/AcademicGradingPolicy";
import { validateGradingPolicy } from "@/lib/academics/assessment-engine/validate-assessment-plan";
import type { AcademicGradingPolicyDTO } from "@/types/academics/assessment-engine";
import { z } from "zod";

const objectIdSchema = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
  message: "Invalid ObjectId",
});

const scoreComponentInputSchema = z.object({
  key: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(200),
  weight: z.number().min(0).max(100),
  order: z.number().int().min(0),
  required: z.boolean(),
  allowedAssessmentTypes: z.array(z.string().trim()).default([]),
});

const gradeBoundaryInputSchema = z.object({
  minPercentage: z.number().min(0).max(100),
  maxPercentage: z.number().min(0).max(100),
  gradeLabel: z.string().trim().min(1).max(40),
  gradePoint: z.number().nullable().optional(),
  descriptor: z.string().trim().max(200).nullable().optional(),
  isPassing: z.boolean().optional(),
  colorToken: z.string().trim().max(40).nullable().optional(),
});

export const gradingPolicyBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  curriculumCode: z.string().trim().max(80).nullable().optional(),
  gradeLabelMode: z.enum(GRADE_LABEL_MODES).optional(),
  appliesToGradeIds: z.array(objectIdSchema).optional(),
  appliesToGradeBandCodes: z.array(z.string().trim().min(1)).optional(),
  isDefault: z.boolean().optional(),
  scoreComponents: z.array(scoreComponentInputSchema).min(1),
  gradeBoundaries: z.array(gradeBoundaryInputSchema).min(1),
  passMark: z.number().min(0).max(100),
  roundingRule: z.enum(ROUNDING_RULES).optional(),
  showClassPosition: z.boolean().optional(),
  showSubjectPosition: z.boolean().optional(),
  showGradeKey: z.boolean().optional(),
  allowTeacherContributionSelection: z.boolean().optional(),
  requireAdminApprovalForPolicyChanges: z.boolean().optional(),
});

export type GradingPolicyBodyInput = z.infer<typeof gradingPolicyBodySchema>;

export function parseGradingPolicyBody(
  body: unknown
): { ok: true; data: GradingPolicyBodyInput } | { ok: false; error: string } {
  const parsed = gradingPolicyBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid grading policy payload",
    };
  }
  return { ok: true, data: parsed.data };
}

export function serializeGradingPolicy(
  policy: IAcademicGradingPolicy | Record<string, unknown>
): AcademicGradingPolicyDTO {
  const row = policy as IAcademicGradingPolicy;
  return {
    _id: String(row._id),
    schoolId: String(row.schoolId),
    name: row.name,
    description: row.description ?? null,
    curriculumCode: row.curriculumCode ?? null,
    gradeLabelMode: row.gradeLabelMode,
    appliesToGradeIds: (row.appliesToGradeIds ?? []).map(String),
    appliesToGradeBandCodes: row.appliesToGradeBandCodes ?? [],
    isDefault: row.isDefault ?? false,
    status: row.status,
    scoreComponents: row.scoreComponents ?? [],
    gradeBoundaries: row.gradeBoundaries ?? [],
    passMark: row.passMark,
    roundingRule: row.roundingRule,
    showClassPosition: row.showClassPosition ?? true,
    showSubjectPosition: row.showSubjectPosition ?? false,
    showGradeKey: row.showGradeKey ?? true,
    allowTeacherContributionSelection:
      row.allowTeacherContributionSelection ?? true,
    requireAdminApprovalForPolicyChanges:
      row.requireAdminApprovalForPolicyChanges ?? false,
    createdBy: row.createdBy ? String(row.createdBy) : null,
    updatedBy: row.updatedBy ? String(row.updatedBy) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function validateGradingPolicyPayload(input: GradingPolicyBodyInput) {
  return validateGradingPolicy({
    scoreComponents: input.scoreComponents,
    gradeBoundaries: input.gradeBoundaries,
    passMark: input.passMark,
  });
}

export async function assertGradeIdsBelongToSchool(
  schoolId: mongoose.Types.ObjectId,
  gradeIds: string[]
) {
  if (!gradeIds.length) return { ok: true as const };

  const objectIds = gradeIds.map((id) => new mongoose.Types.ObjectId(id));
  const count = await Grade.countDocuments({
    _id: { $in: objectIds },
    schoolId,
  });

  if (count !== gradeIds.length) {
    return {
      ok: false as const,
      error: "One or more grades do not belong to this school.",
    };
  }

  return { ok: true as const };
}

export function buildGradingPolicyDocument(
  input: GradingPolicyBodyInput,
  options: {
    schoolId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    status?: IAcademicGradingPolicy["status"];
  }
) {
  return {
    schoolId: options.schoolId,
    name: input.name,
    description: input.description ?? null,
    curriculumCode: input.curriculumCode ?? null,
    gradeLabelMode: input.gradeLabelMode ?? "letters",
    appliesToGradeIds: (input.appliesToGradeIds ?? []).map(
      (id) => new mongoose.Types.ObjectId(id)
    ),
    appliesToGradeBandCodes: input.appliesToGradeBandCodes ?? [],
    isDefault: input.isDefault ?? false,
    status: options.status ?? "draft",
    scoreComponents: input.scoreComponents,
    gradeBoundaries: input.gradeBoundaries,
    passMark: input.passMark,
    roundingRule: input.roundingRule ?? "one_decimal",
    showClassPosition: input.showClassPosition ?? true,
    showSubjectPosition: input.showSubjectPosition ?? false,
    showGradeKey: input.showGradeKey ?? true,
    allowTeacherContributionSelection:
      input.allowTeacherContributionSelection ?? true,
    requireAdminApprovalForPolicyChanges:
      input.requireAdminApprovalForPolicyChanges ?? false,
    createdBy: options.userId,
    updatedBy: options.userId,
  };
}

function normalizeCurriculumCode(value?: string | null) {
  return value?.trim() || null;
}

function gradeScopesOverlap(
  policyA: Pick<
    IAcademicGradingPolicy,
    "appliesToGradeIds" | "appliesToGradeBandCodes" | "isDefault" | "curriculumCode"
  >,
  policyB: Pick<
    IAcademicGradingPolicy,
    "appliesToGradeIds" | "appliesToGradeBandCodes" | "isDefault" | "curriculumCode"
  >
) {
  const curriculumA = normalizeCurriculumCode(policyA.curriculumCode);
  const curriculumB = normalizeCurriculumCode(policyB.curriculumCode);
  if (curriculumA !== curriculumB) return false;

  const gradeIdsA = (policyA.appliesToGradeIds ?? []).map(String);
  const gradeIdsB = (policyB.appliesToGradeIds ?? []).map(String);
  const bandsA = policyA.appliesToGradeBandCodes ?? [];
  const bandsB = policyB.appliesToGradeBandCodes ?? [];

  const aIsSchoolWide =
    gradeIdsA.length === 0 && bandsA.length === 0 && policyA.isDefault;
  const bIsSchoolWide =
    gradeIdsB.length === 0 && bandsB.length === 0 && policyB.isDefault;

  if (aIsSchoolWide || bIsSchoolWide) return true;

  if (
    gradeIdsA.some((gradeId) => gradeIdsB.includes(gradeId)) ||
    bandsA.some((band) => bandsB.includes(band))
  ) {
    return true;
  }

  if (policyA.isDefault && policyB.isDefault) return true;

  return false;
}

export async function activateGradingPolicy(options: {
  schoolId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  policyId: mongoose.Types.ObjectId;
}) {
  const policy = await AcademicGradingPolicy.findOne({
    _id: options.policyId,
    schoolId: options.schoolId,
  });

  if (!policy) {
    return { ok: false as const, status: 404, error: "Grading policy not found" };
  }

  if (policy.status === "archived") {
    return {
      ok: false as const,
      status: 400,
      error: "Archived grading policies cannot be activated.",
    };
  }

  const validation = validateGradingPolicy({
    scoreComponents: policy.scoreComponents,
    gradeBoundaries: policy.gradeBoundaries,
    passMark: policy.passMark,
  });

  if (!validation.valid) {
    return {
      ok: false as const,
      status: 400,
      error: validation.errors.join(" "),
      errors: validation.errors,
    };
  }

  const activePolicies = await AcademicGradingPolicy.find({
    schoolId: options.schoolId,
    status: "active",
    _id: { $ne: policy._id },
  }).select("_id appliesToGradeIds appliesToGradeBandCodes isDefault curriculumCode");

  const overlappingIds = activePolicies
    .filter((activePolicy) => gradeScopesOverlap(policy, activePolicy))
    .map((activePolicy) => activePolicy._id);

  if (overlappingIds.length > 0) {
    await AcademicGradingPolicy.updateMany(
      { _id: { $in: overlappingIds }, schoolId: options.schoolId },
      {
        $set: {
          status: "archived",
          updatedBy: options.userId,
        },
      }
    );
  }

  policy.status = "active";
  policy.updatedBy = options.userId;
  await policy.save();

  return { ok: true as const, data: serializeGradingPolicy(policy) };
}

export async function listGradingPolicies(options: {
  schoolId: mongoose.Types.ObjectId;
  status?: string | null;
  curriculumCode?: string | null;
}) {
  const query: Record<string, unknown> = { schoolId: options.schoolId };
  if (options.status && options.status !== "all") {
    query.status = options.status;
  }
  if (options.curriculumCode && options.curriculumCode !== "all") {
    query.curriculumCode = options.curriculumCode;
  }

  const rows = await AcademicGradingPolicy.find(query)
    .sort({ status: 1, updatedAt: -1 })
    .lean();

  return rows.map((row) => serializeGradingPolicy(row));
}
