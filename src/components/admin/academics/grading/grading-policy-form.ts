import type {
  GradeBoundary,
  GradeLabelMode,
  RoundingRule,
  ScoreComponent,
} from "@/types/academics/assessment-engine";
import type { AcademicGradingPolicyDTO } from "@/types/academics/assessment-engine";
import type { GradingPolicyBodyInput } from "@/lib/academics/assessment-engine/grading-policy-service";

export type GradingPolicyFormState = GradingPolicyBodyInput;

export function slugifyComponentKey(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function createDefaultGradingPolicyForm(): GradingPolicyFormState {
  return {
    name: "",
    description: "",
    curriculumCode: null,
    gradeLabelMode: "letters",
    appliesToGradeIds: [],
    appliesToGradeBandCodes: [],
    isDefault: true,
    scoreComponents: [
      {
        key: "classroom_work",
        label: "Classroom Work",
        weight: 30,
        order: 1,
        required: true,
        allowedAssessmentTypes: ["classwork", "homework", "quiz", "assignment"],
      },
      {
        key: "exam",
        label: "Exam",
        weight: 70,
        order: 2,
        required: true,
        allowedAssessmentTypes: ["exam", "mock", "final"],
      },
    ],
    gradeBoundaries: [
      {
        minPercentage: 80,
        maxPercentage: 100,
        gradeLabel: "A",
        gradePoint: 4,
        descriptor: "Excellent",
        isPassing: true,
      },
      {
        minPercentage: 70,
        maxPercentage: 79.99,
        gradeLabel: "B",
        gradePoint: 3,
        descriptor: "Very Good",
        isPassing: true,
      },
      {
        minPercentage: 60,
        maxPercentage: 69.99,
        gradeLabel: "C",
        gradePoint: 2,
        descriptor: "Good",
        isPassing: true,
      },
      {
        minPercentage: 0,
        maxPercentage: 59.99,
        gradeLabel: "D",
        gradePoint: 1,
        descriptor: "Needs Improvement",
        isPassing: false,
      },
    ],
    passMark: 50,
    roundingRule: "one_decimal",
    showClassPosition: true,
    showSubjectPosition: false,
    showGradeKey: true,
    allowTeacherContributionSelection: true,
    requireAdminApprovalForPolicyChanges: false,
  };
}

export function policyToFormState(policy: AcademicGradingPolicyDTO): GradingPolicyFormState {
  return {
    name: policy.name,
    description: policy.description ?? "",
    curriculumCode: policy.curriculumCode ?? null,
    gradeLabelMode: policy.gradeLabelMode,
    appliesToGradeIds: policy.appliesToGradeIds ?? [],
    appliesToGradeBandCodes: policy.appliesToGradeBandCodes ?? [],
    isDefault: policy.isDefault,
    scoreComponents: policy.scoreComponents.map((component) => ({ ...component })),
    gradeBoundaries: policy.gradeBoundaries.map((boundary) => ({ ...boundary })),
    passMark: policy.passMark,
    roundingRule: policy.roundingRule,
    showClassPosition: policy.showClassPosition,
    showSubjectPosition: policy.showSubjectPosition,
    showGradeKey: policy.showGradeKey,
    allowTeacherContributionSelection: policy.allowTeacherContributionSelection,
    requireAdminApprovalForPolicyChanges: policy.requireAdminApprovalForPolicyChanges,
  };
}

export function sumComponentWeights(components: ScoreComponent[]) {
  return components.reduce((sum, component) => sum + (Number(component.weight) || 0), 0);
}

export function createEmptyComponent(order: number): ScoreComponent {
  const label = `Component ${order}`;
  return {
    key: slugifyComponentKey(label) || `component_${order}`,
    label,
    weight: 0,
    order,
    required: false,
    allowedAssessmentTypes: ["classwork", "homework"],
  };
}

export function createEmptyBoundary(): GradeBoundary {
  return {
    minPercentage: 0,
    maxPercentage: 100,
    gradeLabel: "",
    gradePoint: null,
    descriptor: null,
    isPassing: true,
  };
}

export const GRADE_LABEL_MODE_OPTIONS: Array<{ value: GradeLabelMode; label: string }> = [
  { value: "letters", label: "Letter grades" },
  { value: "numbers", label: "Numeric grades" },
  { value: "descriptors", label: "Descriptors" },
  { value: "custom", label: "Custom labels" },
];

export const ROUNDING_RULE_OPTIONS: Array<{ value: RoundingRule; label: string }> = [
  { value: "none", label: "No rounding" },
  { value: "nearest_integer", label: "Nearest whole number" },
  { value: "one_decimal", label: "One decimal place" },
  { value: "two_decimals", label: "Two decimal places" },
];

export const COMMON_ASSESSMENT_TYPE_OPTIONS = [
  "classwork",
  "homework",
  "quiz",
  "assignment",
  "project",
  "exam",
  "mock",
  "final",
  "oral",
  "practical",
] as const;
