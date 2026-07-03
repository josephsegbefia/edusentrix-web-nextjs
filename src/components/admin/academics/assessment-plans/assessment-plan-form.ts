import type { AssessmentPlanBodyInput } from "@/lib/academics/assessment-engine/assessment-plan-service";
import type {
  AcademicGradingPolicyDTO,
  AssessmentPlanDTO,
  ComponentRule,
  ContributionMode,
} from "@/types/academics/assessment-engine";

export type AssessmentPlanWizardState = {
  name: string;
  academicPeriodId: string;
  gradingPolicyId: string;
  appliesToGradeId: string;
  appliesToGradeIds: string[];
  appliesToClassGroupIds: string[];
  componentRules: ComponentRule[];
  teacherCanCreateReportItems: boolean;
  teacherCanMarkItemsAsReportContributing: boolean;
  allowOfflineMarks: boolean;
  allowAppAssignmentImport: boolean;
  allowCsvImport: boolean;
};

export const ASSESSMENT_PLAN_WIZARD_STEPS = [
  { id: "details", title: "Details", description: "Name the plan and set teacher permissions." },
  {
    id: "period-policy",
    title: "Period & policy",
    description: "Choose the academic period and grading policy.",
  },
  {
    id: "scope",
    title: "Grades & classes",
    description: "Select the grades and class groups this plan applies to.",
  },
  {
    id: "rules",
    title: "Component rules",
    description: "Decide how marks contribute to report cards.",
  },
  { id: "review", title: "Review", description: "Confirm and save the assessment plan." },
] as const;

export const MVP_CONTRIBUTION_MODE_OPTIONS: Array<{
  value: ContributionMode;
  label: string;
  help: string;
  group: "teacher" | "rule";
}> = [
  {
    value: "teacher_selected",
    label: "Teacher selected",
    help: "Teachers choose which recorded marks count toward each component.",
    group: "teacher",
  },
  {
    value: "average_all",
    label: "Average all",
    help: "Automatically average all eligible marks in the component.",
    group: "rule",
  },
  {
    value: "best_n",
    label: "Best N",
    help: "Use the best N marks by percentage.",
    group: "rule",
  },
  {
    value: "fixed_required_item",
    label: "Fixed required item",
    help: "Require specific assessment types such as the end-of-term exam.",
    group: "rule",
  },
  {
    value: "weighted_items",
    label: "Weighted by max score",
    help: "Combine marks using each item's max score as weight.",
    group: "rule",
  },
];

export function createDefaultWizardState(): AssessmentPlanWizardState {
  return {
    name: "",
    academicPeriodId: "",
    gradingPolicyId: "",
    appliesToGradeId: "",
    appliesToGradeIds: [],
    appliesToClassGroupIds: [],
    componentRules: [],
    teacherCanCreateReportItems: true,
    teacherCanMarkItemsAsReportContributing: true,
    allowOfflineMarks: true,
    allowAppAssignmentImport: true,
    allowCsvImport: false,
  };
}

export function planToWizardState(plan: AssessmentPlanDTO): AssessmentPlanWizardState {
  return {
    name: plan.name,
    academicPeriodId: plan.academicPeriodId,
    gradingPolicyId: plan.gradingPolicyId,
    appliesToGradeId: plan.appliesToGradeId,
    appliesToGradeIds: plan.appliesToGradeIds?.length
      ? plan.appliesToGradeIds
      : plan.appliesToGradeId
        ? [plan.appliesToGradeId]
        : [],
    appliesToClassGroupIds: plan.appliesToClassGroupIds,
    componentRules: plan.componentRules.map((rule) => ({ ...rule })),
    teacherCanCreateReportItems: plan.teacherCanCreateReportItems,
    teacherCanMarkItemsAsReportContributing: plan.teacherCanMarkItemsAsReportContributing,
    allowOfflineMarks: plan.allowOfflineMarks,
    allowAppAssignmentImport: plan.allowAppAssignmentImport,
    allowCsvImport: plan.allowCsvImport,
  };
}

export function defaultRulesFromPolicy(policy: AcademicGradingPolicyDTO): ComponentRule[] {
  return policy.scoreComponents.map((component) => ({
    componentKey: component.key,
    contributionMode: component.key === "exam" ? "fixed_required_item" : "teacher_selected",
    ...(component.key === "exam"
      ? { requiredAssessmentTypes: ["exam"] }
      : { minItems: 2, maxItems: 5 }),
  }));
}

export function syncComponentRules(
  policy: AcademicGradingPolicyDTO | null | undefined,
  existingRules: ComponentRule[]
): ComponentRule[] {
  if (!policy) return [];

  return policy.scoreComponents.map((component) => {
    const existing = existingRules.find((rule) => rule.componentKey === component.key);
    if (existing) return { ...existing };
    const defaults = defaultRulesFromPolicy(policy);
    return defaults.find((rule) => rule.componentKey === component.key) ?? {
      componentKey: component.key,
      contributionMode: "average_all",
    };
  });
}

export function buildAssessmentPlanPayload(
  state: AssessmentPlanWizardState
): AssessmentPlanBodyInput {
  return {
    name: state.name.trim(),
    academicPeriodId: state.academicPeriodId,
    gradingPolicyId: state.gradingPolicyId,
    appliesToGradeId: state.appliesToGradeIds[0] ?? state.appliesToGradeId,
    appliesToGradeIds: state.appliesToGradeIds,
    appliesToClassGroupIds: state.appliesToClassGroupIds,
    componentRules: state.componentRules,
    teacherCanCreateReportItems: state.teacherCanCreateReportItems,
    teacherCanMarkItemsAsReportContributing: state.teacherCanMarkItemsAsReportContributing,
    allowOfflineMarks: state.allowOfflineMarks,
    allowAppAssignmentImport: state.allowAppAssignmentImport,
    allowCsvImport: state.allowCsvImport,
  };
}

export function validateWizardStep(
  step: number,
  state: AssessmentPlanWizardState,
  policy?: AcademicGradingPolicyDTO | null
): string | null {
  if (step === 1 && !state.name.trim()) {
    return "Plan name is required.";
  }

  if (step === 2) {
    if (!state.academicPeriodId) return "Select an academic period.";
    if (!state.gradingPolicyId) return "Select a grading policy.";
    if (policy?.status === "archived") {
      return "Archived grading policies cannot be used.";
    }
  }

  if (step === 3) {
    if (!state.appliesToGradeIds.length) return "Select at least one grade.";
    if (!state.appliesToClassGroupIds.length) {
      return "Select at least one class group.";
    }
  }

  if (step === 4) {
    for (const rule of state.componentRules) {
      if (rule.contributionMode === "best_n" && (rule.bestN ?? 0) < 1) {
        return `Best N is required for component "${rule.componentKey}".`;
      }
      if (
        rule.contributionMode === "teacher_selected" &&
        rule.minItems != null &&
        rule.maxItems != null &&
        rule.minItems > rule.maxItems
      ) {
        return `Invalid item limits for component "${rule.componentKey}".`;
      }
      if (rule.contributionMode === "fixed_required_item") {
        const hasCriteria =
          (rule.requiredAssessmentTypes?.length ?? 0) > 0 ||
          (rule.requiredItemLabels?.length ?? 0) > 0;
        if (!hasCriteria) {
          return `Fixed required item needs assessment types for "${rule.componentKey}".`;
        }
      }
    }
  }

  return null;
}
