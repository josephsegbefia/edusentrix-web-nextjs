import mongoose from "mongoose";
import { z } from "zod";
import {
  ASSESSMENT_ENGINE_ASSESSMENT_TYPES,
  ASSESSMENT_ITEM_STATUSES,
  ASSESSMENT_ITEM_VISIBILITIES,
  ASSESSMENT_SOURCE_TYPES,
  MISSING_SCORE_POLICIES,
} from "@/constants/academics/assessment-engine";
import { AssessmentItem, type IAssessmentItem } from "@/models/AssessmentItem";
import { recordAssessmentMarksAudit } from "@/lib/academics/assessment-engine/assessment-marks-audit";
import {
  resolveTeacherMarksScope,
} from "@/lib/academics/assessment-engine/assessment-marks-context";
import { ruleForComponent } from "@/lib/academics/assessment-engine/assessment-item-rules";
import {
  serializeAssessmentItem,
  type TeacherGradebookAccessContext,
} from "@/lib/academics/assessment-engine/teacher-gradebook-service";
import type {
  AssessmentItemDTO,
  AssessmentPlanDTO,
  AcademicGradingPolicyDTO,
  ComponentRule,
} from "@/types/academics/assessment-engine";

const objectIdSchema = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
  message: "Invalid ObjectId",
});

const optionalDateSchema = z
  .union([z.string().datetime(), z.string().date(), z.null()])
  .optional();

export const createAssessmentItemBodySchema = z.object({
  classGroupId: objectIdSchema,
  subjectId: objectIdSchema,
  academicPeriodId: objectIdSchema.optional(),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).nullable().optional(),
  assessmentType: z.enum(ASSESSMENT_ENGINE_ASSESSMENT_TYPES),
  sourceType: z.enum(ASSESSMENT_SOURCE_TYPES).optional(),
  maxScore: z.number().min(1).max(1000),
  componentKey: z.string().trim().max(80).nullable().optional(),
  contributesToReport: z.boolean().optional(),
  dateAssigned: optionalDateSchema,
  dateDue: optionalDateSchema,
  assessedAt: optionalDateSchema,
  visibility: z.enum(ASSESSMENT_ITEM_VISIBILITIES).optional(),
  status: z.enum(["draft", "open"]).optional(),
  missingPolicy: z.enum(MISSING_SCORE_POLICIES).optional(),
});

export const updateAssessmentItemBodySchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    assessmentType: z.enum(ASSESSMENT_ENGINE_ASSESSMENT_TYPES).optional(),
    maxScore: z.number().min(1).max(1000).optional(),
    componentKey: z.string().trim().max(80).nullable().optional(),
    contributesToReport: z.boolean().optional(),
    dateAssigned: optionalDateSchema,
    dateDue: optionalDateSchema,
    assessedAt: optionalDateSchema,
    visibility: z.enum(ASSESSMENT_ITEM_VISIBILITIES).optional(),
    status: z.enum(ASSESSMENT_ITEM_STATUSES).optional(),
    missingPolicy: z.enum(MISSING_SCORE_POLICIES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export type CreateAssessmentItemBody = z.infer<typeof createAssessmentItemBodySchema>;
export type UpdateAssessmentItemBody = z.infer<typeof updateAssessmentItemBodySchema>;

export type TeacherMarksMutationContext = TeacherGradebookAccessContext & {
  userId: mongoose.Types.ObjectId;
};

function parseDate(value?: string | null) {
  if (value == null || value === "") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function componentExists(
  componentKey: string | null | undefined,
  policy: AcademicGradingPolicyDTO
) {
  if (!componentKey) return true;
  return policy.scoreComponents.some((component) => component.key === componentKey);
}

function assessmentTypeAllowedForComponent(
  componentKey: string | null | undefined,
  assessmentType: string,
  policy: AcademicGradingPolicyDTO
) {
  if (!componentKey) return true;
  const component = policy.scoreComponents.find((entry) => entry.key === componentKey);
  if (!component) return false;
  if (component.allowedAssessmentTypes.length === 0) return true;
  return component.allowedAssessmentTypes.includes(assessmentType);
}

function matchesFixedRequiredItem(
  assessmentType: string,
  title: string,
  rule: ComponentRule
) {
  const matchesType = rule.requiredAssessmentTypes?.includes(assessmentType) ?? false;
  const matchesLabel = rule.requiredItemLabels?.includes(title) ?? false;
  return matchesType || matchesLabel;
}

export function resolveContributionFlags(input: {
  componentKey?: string | null;
  assessmentType: string;
  title: string;
  requestedContributesToReport?: boolean;
  assessmentPlan: AssessmentPlanDTO;
  gradingPolicy: AcademicGradingPolicyDTO;
}): { ok: true; contributesToReport: boolean; contributionLockedByRule: boolean } | { ok: false; error: string } {
  const { componentKey, assessmentType, title, requestedContributesToReport, assessmentPlan, gradingPolicy } =
    input;

  if (!componentExists(componentKey, gradingPolicy)) {
    return { ok: false, error: "Component key is not defined in the grading policy." };
  }

  if (!assessmentTypeAllowedForComponent(componentKey, assessmentType, gradingPolicy)) {
    return {
      ok: false,
      error: "Assessment type is not allowed for the selected component.",
    };
  }

  if (requestedContributesToReport && !assessmentPlan.teacherCanMarkItemsAsReportContributing) {
    return {
      ok: false,
      error: "This assessment plan does not allow teachers to mark report contributions.",
    };
  }

  if (!componentKey) {
    return {
      ok: true,
      contributesToReport: false,
      contributionLockedByRule: false,
    };
  }

  const rule = ruleForComponent(componentKey, assessmentPlan.componentRules);

  if (rule.contributionMode === "fixed_required_item") {
    const locked = matchesFixedRequiredItem(assessmentType, title, rule);
    return {
      ok: true,
      contributesToReport: locked,
      contributionLockedByRule: locked,
    };
  }

  if (rule.contributionMode === "teacher_selected") {
    return {
      ok: true,
      contributesToReport: requestedContributesToReport ?? false,
      contributionLockedByRule: false,
    };
  }

  if (requestedContributesToReport) {
    return {
      ok: false,
      error: "Report contribution is managed automatically for this component rule.",
    };
  }

  return {
    ok: true,
    contributesToReport: false,
    contributionLockedByRule: false,
  };
}

export function canMutateAssessmentItem(item: Pick<IAssessmentItem, "status">) {
  return item.status !== "locked" && item.status !== "archived";
}

export function parseCreateAssessmentItemBody(
  body: unknown
): { ok: true; data: CreateAssessmentItemBody } | { ok: false; error: string } {
  const parsed = createAssessmentItemBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid assessment item payload",
    };
  }
  return { ok: true, data: parsed.data };
}

export function parseUpdateAssessmentItemBody(
  body: unknown
): { ok: true; data: UpdateAssessmentItemBody } | { ok: false; error: string } {
  const parsed = updateAssessmentItemBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid assessment item payload",
    };
  }
  return { ok: true, data: parsed.data };
}

async function loadOwnedAssessmentItem(
  context: TeacherMarksMutationContext,
  itemId: string
) {
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    return { ok: false as const, error: "Invalid assessment item", status: 400 as const };
  }

  const item = await AssessmentItem.findOne({
    _id: new mongoose.Types.ObjectId(itemId),
    schoolId: context.schoolId,
    ...(context.isAdmin ? {} : { teacherId: context.teacherId }),
  }).lean();

  if (!item) {
    return { ok: false as const, error: "Assessment item not found", status: 404 as const };
  }

  return { ok: true as const, item };
}

export async function createAssessmentItem(
  context: TeacherMarksMutationContext,
  body: CreateAssessmentItemBody
): Promise<
  | { ok: true; data: AssessmentItemDTO }
  | { ok: false; error: string; status: 400 | 403 | 404 }
> {
  const scopeResult = await resolveTeacherMarksScope(context, {
    classGroupId: body.classGroupId,
    subjectId: body.subjectId,
    academicPeriodId: body.academicPeriodId,
  });

  if (!scopeResult.ok) {
    return { ok: false, error: scopeResult.error, status: scopeResult.status };
  }

  const scope = scopeResult.scope;
  const sourceType = body.sourceType ?? "manual";

  if (sourceType === "manual" && !scope.assessmentPlan.allowOfflineMarks) {
    return {
      ok: false,
      error: "This assessment plan does not allow offline/manual assessment items.",
      status: 400,
    };
  }

  if (!scope.assessmentPlan.teacherCanCreateReportItems && body.contributesToReport) {
    return {
      ok: false,
      error: "This assessment plan does not allow teachers to create report items.",
      status: 400,
    };
  }

  const contribution = resolveContributionFlags({
    componentKey: body.componentKey,
    assessmentType: body.assessmentType,
    title: body.title.trim(),
    requestedContributesToReport: body.contributesToReport,
    assessmentPlan: scope.assessmentPlan,
    gradingPolicy: scope.gradingPolicy,
  });

  if (!contribution.ok) {
    return { ok: false, error: contribution.error, status: 400 };
  }

  const created = await AssessmentItem.create({
    schoolId: context.schoolId,
    academicPeriodId: scope.academicPeriodId,
    assessmentPlanId: new mongoose.Types.ObjectId(scope.assessmentPlan._id),
    classGroupId: scope.classGroupId,
    gradeId: scope.gradeId,
    subjectId: scope.subjectId,
    teacherId: context.teacherId,
    title: body.title.trim(),
    description: body.description ?? null,
    assessmentType: body.assessmentType,
    sourceType,
    maxScore: body.maxScore,
    dateAssigned: parseDate(body.dateAssigned),
    dateDue: parseDate(body.dateDue),
    assessedAt: parseDate(body.assessedAt),
    componentKey: body.componentKey ?? null,
    contributesToReport: contribution.contributesToReport,
    contributionLockedByRule: contribution.contributionLockedByRule,
    missingPolicy: body.missingPolicy ?? "exclude_from_average",
    visibility: body.visibility ?? "teacher_only",
    status: body.status ?? "draft",
    createdBy: context.userId,
    updatedBy: context.userId,
  });

  await recordAssessmentMarksAudit({
    schoolId: context.schoolId,
    actorUserId: context.userId,
    teacherId: context.teacherId,
    action: "assessment_item.created",
    entityType: "assessment_item",
    entityId: created._id as mongoose.Types.ObjectId,
    classGroupId: scope.classGroupId,
    subjectId: scope.subjectId,
    academicPeriodId: scope.academicPeriodId,
    assessmentPlanId: new mongoose.Types.ObjectId(scope.assessmentPlan._id),
    metadata: {
      title: created.title,
      assessmentType: created.assessmentType,
      componentKey: created.componentKey,
      contributesToReport: created.contributesToReport,
      sourceType: created.sourceType,
    },
  });

  return { ok: true, data: serializeAssessmentItem(created.toObject()) };
}

export async function updateAssessmentItem(
  context: TeacherMarksMutationContext,
  itemId: string,
  body: UpdateAssessmentItemBody
): Promise<
  | { ok: true; data: AssessmentItemDTO }
  | { ok: false; error: string; status: 400 | 403 | 404 }
> {
  const loaded = await loadOwnedAssessmentItem(context, itemId);
  if (!loaded.ok) {
    return { ok: false, error: loaded.error, status: loaded.status };
  }

  const existing = loaded.item;
  if (!canMutateAssessmentItem(existing)) {
    return {
      ok: false,
      error: "Locked or archived assessment items cannot be edited.",
      status: 400,
    };
  }

  const scopeResult = await resolveTeacherMarksScope(context, {
    classGroupId: String(existing.classGroupId),
    subjectId: String(existing.subjectId),
    academicPeriodId: String(existing.academicPeriodId),
  });

  if (!scopeResult.ok) {
    return { ok: false, error: scopeResult.error, status: scopeResult.status };
  }

  const scope = scopeResult.scope;
  const nextTitle = body.title?.trim() ?? existing.title;
  const nextAssessmentType = body.assessmentType ?? existing.assessmentType;
  const nextComponentKey =
    body.componentKey !== undefined ? body.componentKey : existing.componentKey;

  if (body.contributesToReport !== undefined && existing.contributionLockedByRule) {
    return {
      ok: false,
      error: "Report contribution is locked by the assessment plan rule.",
      status: 400,
    };
  }

  const contribution = resolveContributionFlags({
    componentKey: nextComponentKey,
    assessmentType: nextAssessmentType,
    title: nextTitle,
    requestedContributesToReport:
      body.contributesToReport !== undefined
        ? body.contributesToReport
        : existing.contributesToReport,
    assessmentPlan: scope.assessmentPlan,
    gradingPolicy: scope.gradingPolicy,
  });

  if (!contribution.ok) {
    return { ok: false, error: contribution.error, status: 400 };
  }

  if (body.status === "archived" && existing.status === "archived") {
    return { ok: false, error: "Assessment item is already archived.", status: 400 };
  }

  const update: Record<string, unknown> = {
    updatedBy: context.userId,
  };

  if (body.title !== undefined) update.title = nextTitle;
  if (body.description !== undefined) update.description = body.description;
  if (body.assessmentType !== undefined) update.assessmentType = nextAssessmentType;
  if (body.maxScore !== undefined) update.maxScore = body.maxScore;
  if (body.componentKey !== undefined) update.componentKey = nextComponentKey;
  if (body.contributesToReport !== undefined || body.componentKey !== undefined || body.assessmentType !== undefined || body.title !== undefined) {
    update.contributesToReport = contribution.contributesToReport;
    update.contributionLockedByRule = contribution.contributionLockedByRule;
  }
  if (body.dateAssigned !== undefined) update.dateAssigned = parseDate(body.dateAssigned);
  if (body.dateDue !== undefined) update.dateDue = parseDate(body.dateDue);
  if (body.assessedAt !== undefined) update.assessedAt = parseDate(body.assessedAt);
  if (body.visibility !== undefined) update.visibility = body.visibility;
  if (body.status !== undefined) update.status = body.status;
  if (body.missingPolicy !== undefined) update.missingPolicy = body.missingPolicy;

  const updated = await AssessmentItem.findOneAndUpdate(
    { _id: existing._id, schoolId: context.schoolId },
    { $set: update },
    { new: true }
  ).lean();

  if (!updated) {
    return { ok: false, error: "Assessment item not found", status: 404 };
  }

  const action =
    body.status === "archived" ? "assessment_item.archived" : "assessment_item.updated";

  await recordAssessmentMarksAudit({
    schoolId: context.schoolId,
    actorUserId: context.userId,
    teacherId: context.teacherId,
    action,
    entityType: "assessment_item",
    entityId: updated._id as mongoose.Types.ObjectId,
    classGroupId: scope.classGroupId,
    subjectId: scope.subjectId,
    academicPeriodId: scope.academicPeriodId,
    assessmentPlanId: new mongoose.Types.ObjectId(scope.assessmentPlan._id),
    metadata: {
      beforeStatus: existing.status,
      afterStatus: updated.status,
      changedFields: Object.keys(body),
    },
  });

  return { ok: true, data: serializeAssessmentItem(updated) };
}
