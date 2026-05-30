import type {
  AssessmentEngineAssessmentType,
  AssessmentItemDTO,
  TeacherGradebookV2DTO,
} from "@/types/academics/assessment-engine";
import { ASSESSMENT_ENGINE_ASSESSMENT_TYPES } from "@/constants/academics/assessment-engine";
import type { CreateAssessmentItemBody } from "@/lib/academics/assessment-engine/assessment-item-service";

export type AssessmentItemFormState = {
  title: string;
  description: string;
  assessmentType: AssessmentEngineAssessmentType | string;
  maxScore: number;
  componentKey: string;
  contributesToReport: boolean;
  assessedAt: Date | null;
  status: "draft" | "open";
};

export function createDefaultItemFormState(
  gradebook: TeacherGradebookV2DTO
): AssessmentItemFormState {
  const firstComponent = gradebook.gradingPolicy?.scoreComponents[0];

  return {
    title: "",
    description: "",
    assessmentType: firstComponent?.allowedAssessmentTypes[0] ?? "classwork",
    maxScore: 20,
    componentKey: firstComponent?.key ?? "",
    contributesToReport: false,
    assessedAt: null,
    status: "draft",
  };
}

export function itemToFormState(item: AssessmentItemDTO): AssessmentItemFormState {
  return {
    title: item.title,
    description: item.description ?? "",
    assessmentType: item.assessmentType,
    maxScore: item.maxScore,
    componentKey: item.componentKey ?? "",
    contributesToReport: item.contributesToReport,
    assessedAt: item.assessedAt ? new Date(item.assessedAt) : null,
    status: item.status === "open" ? "open" : "draft",
  };
}

export function buildCreateAssessmentItemPayload(
  gradebook: TeacherGradebookV2DTO,
  classGroupId: string,
  subjectId: string,
  form: AssessmentItemFormState
): CreateAssessmentItemBody {
  return {
    classGroupId,
    subjectId,
    academicPeriodId: gradebook.academicPeriod?._id,
    title: form.title.trim(),
    description: form.description.trim() ? form.description.trim() : null,
    assessmentType: form.assessmentType as AssessmentEngineAssessmentType,
    sourceType: "manual",
    maxScore: form.maxScore,
    componentKey: form.componentKey || null,
    contributesToReport: form.contributesToReport,
    assessedAt: form.assessedAt ? form.assessedAt.toISOString() : null,
    status: form.status,
  };
}

export function getAssessmentTypeOptions(
  gradebook: TeacherGradebookV2DTO,
  componentKey: string
) {
  const policy = gradebook.gradingPolicy;
  if (!policy) return [...ASSESSMENT_ENGINE_ASSESSMENT_TYPES];

  const component = policy.scoreComponents.find((entry) => entry.key === componentKey);
  if (!component || component.allowedAssessmentTypes.length === 0) {
    return [...ASSESSMENT_ENGINE_ASSESSMENT_TYPES];
  }

  return component.allowedAssessmentTypes.filter((type) =>
    ASSESSMENT_ENGINE_ASSESSMENT_TYPES.includes(type as AssessmentEngineAssessmentType)
  );
}

export function validateAssessmentItemForm(form: AssessmentItemFormState): string | null {
  if (!form.title.trim()) return "Title is required.";
  if (!form.componentKey) return "Select a score component.";
  if (!Number.isFinite(form.maxScore) || form.maxScore <= 0) {
    return "Max score must be greater than zero.";
  }
  return null;
}

export function canEditAssessmentItem(item: AssessmentItemDTO) {
  return item.status !== "locked" && item.status !== "archived";
}

export function canArchiveAssessmentItem(item: AssessmentItemDTO) {
  return item.status !== "archived" && item.status !== "locked";
}
