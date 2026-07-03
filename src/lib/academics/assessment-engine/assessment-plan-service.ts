import mongoose from "mongoose";
import { z } from "zod";
import { CONTRIBUTION_MODES } from "@/constants/academics/assessment-engine";
import { AcademicGradingPolicy } from "@/models/AcademicGradingPolicy";
import { AcademicPeriod } from "@/models/AcademicPeriod";
import { AssessmentPlan, type IAssessmentPlan } from "@/models/AssessmentPlan";
import { ClassGroup } from "@/models/ClassGroup";
import { Grade } from "@/models/Grade";
import { validateAssessmentPlan } from "@/lib/academics/assessment-engine/validate-assessment-plan";
import type { AssessmentPlanDTO, GradingPolicyStatus, ScoreComponent } from "@/types/academics/assessment-engine";

const objectIdSchema = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
  message: "Invalid ObjectId",
});

const componentRuleInputSchema = z.object({
  componentKey: z.string().trim().min(1).max(80),
  contributionMode: z.enum(CONTRIBUTION_MODES),
  minItems: z.number().int().min(0).optional(),
  maxItems: z.number().int().min(0).optional(),
  bestN: z.number().int().min(1).optional(),
  latestN: z.number().int().min(1).optional(),
  dropLowestCount: z.number().int().min(0).optional(),
  requiredAssessmentTypes: z.array(z.string().trim()).optional(),
  requiredItemLabels: z.array(z.string().trim()).optional(),
  allowManualOverride: z.boolean().optional(),
  requireHomeroomApproval: z.boolean().optional(),
  requireAdminApproval: z.boolean().optional(),
});

const minimumCompletionRuleInputSchema = z.object({
  componentKey: z.string().trim().optional(),
  minItems: z.number().int().min(0).optional(),
  minPercentageComplete: z.number().min(0).max(100).optional(),
  requireSubjectRemark: z.boolean().optional(),
  blockSubmissionWhenMissing: z.boolean().optional(),
});

export const assessmentPlanBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
  academicPeriodId: objectIdSchema,
  gradingPolicyId: objectIdSchema,
  appliesToGradeId: objectIdSchema,
  appliesToGradeIds: z.array(objectIdSchema).optional(),
  appliesToClassGroupIds: z.array(objectIdSchema).min(1),
  curriculumCode: z.string().trim().max(80).nullable().optional(),
  componentRules: z.array(componentRuleInputSchema).min(1),
  teacherCanCreateReportItems: z.boolean().optional(),
  teacherCanMarkItemsAsReportContributing: z.boolean().optional(),
  allowOfflineMarks: z.boolean().optional(),
  allowAppAssignmentImport: z.boolean().optional(),
  allowCsvImport: z.boolean().optional(),
  minimumCompletionRules: z.array(minimumCompletionRuleInputSchema).optional(),
});

export type AssessmentPlanBodyInput = z.infer<typeof assessmentPlanBodySchema>;

export function parseAssessmentPlanBody(
  body: unknown
): { ok: true; data: AssessmentPlanBodyInput } | { ok: false; error: string } {
  const parsed = assessmentPlanBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid assessment plan payload",
    };
  }
  return { ok: true, data: parsed.data };
}

export function serializeAssessmentPlan(
  plan: IAssessmentPlan | Record<string, unknown>
): AssessmentPlanDTO {
  const row = plan as IAssessmentPlan;
  return {
    _id: String(row._id),
    schoolId: String(row.schoolId),
    name: row.name,
    academicPeriodId: String(row.academicPeriodId),
    gradingPolicyId: String(row.gradingPolicyId),
    appliesToGradeId: String(row.appliesToGradeId),
    appliesToGradeIds: (row.appliesToGradeIds?.length
      ? row.appliesToGradeIds
      : row.appliesToGradeId
        ? [row.appliesToGradeId]
        : []
    ).map(String),
    appliesToClassGroupIds: (row.appliesToClassGroupIds ?? []).map(String),
    curriculumCode: row.curriculumCode ?? null,
    status: row.status,
    componentRules: row.componentRules ?? [],
    teacherCanCreateReportItems: row.teacherCanCreateReportItems ?? true,
    teacherCanMarkItemsAsReportContributing:
      row.teacherCanMarkItemsAsReportContributing ?? true,
    allowOfflineMarks: row.allowOfflineMarks ?? true,
    allowAppAssignmentImport: row.allowAppAssignmentImport ?? true,
    allowCsvImport: row.allowCsvImport ?? false,
    minimumCompletionRules: row.minimumCompletionRules ?? [],
    createdBy: row.createdBy ? String(row.createdBy) : null,
    approvedBy: row.approvedBy ? String(row.approvedBy) : null,
    approvedAt: row.approvedAt ?? null,
    lockedAt: row.lockedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function loadGradingPolicyForPlan(
  schoolId: mongoose.Types.ObjectId,
  gradingPolicyId: string
) {
  const policy = await AcademicGradingPolicy.findOne({
    _id: new mongoose.Types.ObjectId(gradingPolicyId),
    schoolId,
  }).lean();

  if (!policy) {
    return { ok: false as const, error: "Grading policy not found for this school." };
  }

  return { ok: true as const, policy };
}

export function validateAssessmentPlanPayload(
  input: AssessmentPlanBodyInput,
  gradingPolicy: {
    scoreComponents: ScoreComponent[];
    status: GradingPolicyStatus;
  },
  planStatus?: IAssessmentPlan["status"]
) {
  return validateAssessmentPlan({
    scoreComponents: gradingPolicy.scoreComponents,
    componentRules: input.componentRules,
    gradingPolicyStatus: gradingPolicy.status,
    planStatus,
  });
}

export async function assertAcademicPeriodBelongsToSchool(
  schoolId: mongoose.Types.ObjectId,
  academicPeriodId: string
) {
  const period = await AcademicPeriod.findOne({
    _id: new mongoose.Types.ObjectId(academicPeriodId),
    schoolId,
  })
    .select("_id")
    .lean();

  if (!period) {
    return {
      ok: false as const,
      error: "Academic period not found for this school.",
    };
  }

  return { ok: true as const };
}

export async function assertGradeBelongsToSchool(
  schoolId: mongoose.Types.ObjectId,
  gradeId: string
) {
  const grade = await Grade.findOne({
    _id: new mongoose.Types.ObjectId(gradeId),
    schoolId,
  })
    .select("_id")
    .lean();

  if (!grade) {
    return { ok: false as const, error: "Grade not found for this school." };
  }

  return { ok: true as const };
}

export async function assertGradesBelongToSchool(
  schoolId: mongoose.Types.ObjectId,
  gradeIds: string[]
) {
  const uniqueGradeIds = [...new Set(gradeIds)];
  if (!uniqueGradeIds.length) {
    return { ok: false as const, error: "Select at least one grade." };
  }

  const objectIds = uniqueGradeIds.map((id) => new mongoose.Types.ObjectId(id));
  const count = await Grade.countDocuments({
    _id: { $in: objectIds },
    schoolId,
  });

  if (count !== uniqueGradeIds.length) {
    return {
      ok: false as const,
      error: "One or more grades do not belong to this school.",
    };
  }

  return { ok: true as const };
}

export async function assertClassGroupsBelongToGrades(
  schoolId: mongoose.Types.ObjectId,
  gradeIds: string[],
  classGroupIds: string[]
) {
  if (!classGroupIds.length) {
    return {
      ok: false as const,
      error: "At least one class group is required.",
    };
  }

  const objectIds = classGroupIds.map((id) => new mongoose.Types.ObjectId(id));
  const gradeObjectIds = [...new Set(gradeIds)].map((id) => new mongoose.Types.ObjectId(id));
  const count = await ClassGroup.countDocuments({
    _id: { $in: objectIds },
    schoolId,
    gradeId: { $in: gradeObjectIds },
  });

  if (count !== classGroupIds.length) {
    return {
      ok: false as const,
      error: "One or more class groups are invalid for the selected grades.",
    };
  }

  return { ok: true as const };
}

export function buildAssessmentPlanDocument(
  input: AssessmentPlanBodyInput,
  options: {
    schoolId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    status?: IAssessmentPlan["status"];
  }
) {
  const appliesToGradeIds = [
    ...new Set([...(input.appliesToGradeIds ?? []), input.appliesToGradeId]),
  ];

  return {
    schoolId: options.schoolId,
    name: input.name,
    academicPeriodId: new mongoose.Types.ObjectId(input.academicPeriodId),
    gradingPolicyId: new mongoose.Types.ObjectId(input.gradingPolicyId),
    appliesToGradeId: new mongoose.Types.ObjectId(input.appliesToGradeId),
    appliesToGradeIds: appliesToGradeIds.map((id) => new mongoose.Types.ObjectId(id)),
    appliesToClassGroupIds: input.appliesToClassGroupIds.map(
      (id) => new mongoose.Types.ObjectId(id)
    ),
    curriculumCode: input.curriculumCode ?? null,
    status: options.status ?? "draft",
    componentRules: input.componentRules,
    teacherCanCreateReportItems: input.teacherCanCreateReportItems ?? true,
    teacherCanMarkItemsAsReportContributing:
      input.teacherCanMarkItemsAsReportContributing ?? true,
    allowOfflineMarks: input.allowOfflineMarks ?? true,
    allowAppAssignmentImport: input.allowAppAssignmentImport ?? true,
    allowCsvImport: input.allowCsvImport ?? false,
    minimumCompletionRules: input.minimumCompletionRules ?? [],
    createdBy: options.userId,
    approvedBy: null,
    approvedAt: null,
    lockedAt: null,
  };
}

export async function findConflictingActivePlans(options: {
  schoolId: mongoose.Types.ObjectId;
  academicPeriodId: mongoose.Types.ObjectId;
  classGroupIds: mongoose.Types.ObjectId[];
  excludePlanId: mongoose.Types.ObjectId;
}) {
  return AssessmentPlan.find({
    schoolId: options.schoolId,
    academicPeriodId: options.academicPeriodId,
    status: "active",
    _id: { $ne: options.excludePlanId },
    appliesToClassGroupIds: { $in: options.classGroupIds },
  }).select("_id name appliesToClassGroupIds");
}

export async function activateAssessmentPlan(options: {
  schoolId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
}) {
  const plan = await AssessmentPlan.findOne({
    _id: options.planId,
    schoolId: options.schoolId,
  });

  if (!plan) {
    return { ok: false as const, status: 404, error: "Assessment plan not found" };
  }

  if (plan.status === "archived") {
    return {
      ok: false as const,
      status: 400,
      error: "Archived assessment plans cannot be activated.",
    };
  }

  if (plan.status === "locked") {
    return {
      ok: false as const,
      status: 400,
      error: "Locked assessment plans cannot be re-activated.",
    };
  }

  if (!plan.appliesToClassGroupIds.length) {
    return {
      ok: false as const,
      status: 400,
      error: "Assessment plan must include at least one class group before activation.",
    };
  }

  const policyResult = await loadGradingPolicyForPlan(
    options.schoolId,
    String(plan.gradingPolicyId)
  );
  if (!policyResult.ok) {
    return { ok: false as const, status: 400, error: policyResult.error };
  }

  if (policyResult.policy.status !== "active") {
    return {
      ok: false as const,
      status: 400,
      error: "Assessment plans can only be activated with an active grading policy.",
    };
  }

  const validation = validateAssessmentPlan({
    scoreComponents: policyResult.policy.scoreComponents,
    componentRules: plan.componentRules,
    gradingPolicyStatus: policyResult.policy.status,
    planStatus: plan.status,
  });

  if (!validation.valid) {
    return {
      ok: false as const,
      status: 400,
      error: validation.errors.join(" "),
      errors: validation.errors,
    };
  }

  const conflicts = await findConflictingActivePlans({
    schoolId: options.schoolId,
    academicPeriodId: plan.academicPeriodId,
    classGroupIds: plan.appliesToClassGroupIds,
    excludePlanId: plan._id,
  });

  if (conflicts.length > 0) {
    await AssessmentPlan.updateMany(
      { _id: { $in: conflicts.map((entry) => entry._id) }, schoolId: options.schoolId },
      {
        $set: {
          status: "archived",
          approvedBy: null,
          approvedAt: null,
        },
      }
    );
  }

  const classGroupGrades = await ClassGroup.distinct("gradeId", {
    _id: { $in: plan.appliesToClassGroupIds },
    schoolId: options.schoolId,
  });

  plan.status = "active";
  plan.appliesToGradeIds = classGroupGrades;
  plan.appliesToGradeId = classGroupGrades[0] ?? plan.appliesToGradeId;
  plan.approvedBy = options.userId;
  plan.approvedAt = new Date();
  await plan.save();

  return {
    ok: true as const,
    data: serializeAssessmentPlan(plan),
    archivedConflicts: conflicts.map((entry) => String(entry._id)),
  };
}

export async function listAssessmentPlans(options: {
  schoolId: mongoose.Types.ObjectId;
  status?: string | null;
  academicPeriodId?: string | null;
  gradeId?: string | null;
  gradingPolicyId?: string | null;
}) {
  const query: Record<string, unknown> = { schoolId: options.schoolId };

  if (options.status && options.status !== "all") {
    query.status = options.status;
  }
  if (options.academicPeriodId && options.academicPeriodId !== "all") {
    query.academicPeriodId = new mongoose.Types.ObjectId(options.academicPeriodId);
  }
  if (options.gradeId && options.gradeId !== "all") {
    const gradeId = new mongoose.Types.ObjectId(options.gradeId);
    query.$or = [{ appliesToGradeId: gradeId }, { appliesToGradeIds: gradeId }];
  }
  if (options.gradingPolicyId && options.gradingPolicyId !== "all") {
    query.gradingPolicyId = new mongoose.Types.ObjectId(options.gradingPolicyId);
  }

  const rows = await AssessmentPlan.find(query).sort({ status: 1, updatedAt: -1 }).lean();
  return rows.map((row) => serializeAssessmentPlan(row));
}

export async function validateAssessmentPlanReferences(
  schoolId: mongoose.Types.ObjectId,
  input: AssessmentPlanBodyInput,
  planStatus?: IAssessmentPlan["status"]
) {
  const appliesToGradeIds = [
    ...new Set([...(input.appliesToGradeIds ?? []), input.appliesToGradeId]),
  ];
  const [periodCheck, gradeCheck, classGroupCheck, policyResult] = await Promise.all([
    assertAcademicPeriodBelongsToSchool(schoolId, input.academicPeriodId),
    assertGradesBelongToSchool(schoolId, appliesToGradeIds),
    assertClassGroupsBelongToGrades(
      schoolId,
      appliesToGradeIds,
      input.appliesToClassGroupIds
    ),
    loadGradingPolicyForPlan(schoolId, input.gradingPolicyId),
  ]);

  if (!periodCheck.ok) return periodCheck;
  if (!gradeCheck.ok) return gradeCheck;
  if (!classGroupCheck.ok) return classGroupCheck;
  if (!policyResult.ok) return policyResult;

  const policyGradeIds = (policyResult.policy.appliesToGradeIds ?? []).map(String);
  if (policyGradeIds.length > 0) {
    const outsidePolicyScope = appliesToGradeIds.filter(
      (gradeId) => !policyGradeIds.includes(gradeId)
    );
    if (outsidePolicyScope.length > 0) {
      return {
        ok: false as const,
        error: "One or more selected grades are outside the grading policy scope.",
      };
    }
  }

  if (policyResult.policy.status === "archived") {
    return {
      ok: false as const,
      error: "Archived grading policies cannot be assigned to assessment plans.",
    };
  }

  const validation = validateAssessmentPlanPayload(
    input,
    policyResult.policy,
    planStatus
  );

  if (!validation.valid) {
    return {
      ok: false as const,
      error: validation.errors.join(" "),
      errors: validation.errors,
    };
  }

  return { ok: true as const, policy: policyResult.policy };
}
