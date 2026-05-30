import { COMPONENT_WEIGHT_TOTAL } from "@/constants/academics/assessment-engine";
import type {
  AssessmentPlanStatus,
  ComponentRule,
  ContributionMode,
  GradingPolicyStatus,
  ScoreComponent,
} from "@/types/academics/assessment-engine";

export type ValidateGradingPolicyInput = {
  scoreComponents: ScoreComponent[];
  gradeBoundaries: Array<{
    minPercentage: number;
    maxPercentage: number;
    gradeLabel: string;
  }>;
  passMark: number;
  status?: GradingPolicyStatus;
};

export type ValidateAssessmentPlanInput = {
  scoreComponents: ScoreComponent[];
  componentRules: ComponentRule[];
  gradingPolicyStatus?: GradingPolicyStatus;
  planStatus?: AssessmentPlanStatus;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

const MVP_CONTRIBUTION_MODES: ContributionMode[] = [
  "teacher_selected",
  "average_all",
  "best_n",
  "fixed_required_item",
  "weighted_items",
];

function hasOverlappingBoundaries(
  boundaries: ValidateGradingPolicyInput["gradeBoundaries"]
): boolean {
  const sorted = [...boundaries].sort(
    (a, b) => a.minPercentage - b.minPercentage
  );

  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].minPercentage <= sorted[index - 1].maxPercentage) {
      return true;
    }
  }

  return false;
}

export function validateGradingPolicy(
  input: ValidateGradingPolicyInput
): ValidationResult {
  const errors: string[] = [];
  const { scoreComponents, gradeBoundaries, passMark } = input;

  if (!scoreComponents.length) {
    errors.push("At least one score component is required.");
  }

  const componentWeightTotal = scoreComponents.reduce(
    (sum, component) => sum + component.weight,
    0
  );

  if (Math.abs(componentWeightTotal - COMPONENT_WEIGHT_TOTAL) > 0.001) {
    errors.push(
      `Score component weights must total ${COMPONENT_WEIGHT_TOTAL}, but total is ${componentWeightTotal}.`
    );
  }

  const componentKeys = new Set<string>();
  for (const component of scoreComponents) {
    if (!component.key.trim()) {
      errors.push("Each score component must have a key.");
    }
    if (componentKeys.has(component.key)) {
      errors.push(`Duplicate score component key "${component.key}".`);
    }
    componentKeys.add(component.key);

    if (component.weight < 0 || component.weight > COMPONENT_WEIGHT_TOTAL) {
      errors.push(
        `Component "${component.label}" weight must be between 0 and ${COMPONENT_WEIGHT_TOTAL}.`
      );
    }
  }

  if (!gradeBoundaries.length) {
    errors.push("At least one grade boundary is required.");
  }

  for (const boundary of gradeBoundaries) {
    if (boundary.minPercentage > boundary.maxPercentage) {
      errors.push(
        `Grade boundary "${boundary.gradeLabel}" has invalid min/max range.`
      );
    }
  }

  if (hasOverlappingBoundaries(gradeBoundaries)) {
    errors.push("Grade boundaries must not overlap.");
  }

  if (passMark < 0 || passMark > COMPONENT_WEIGHT_TOTAL) {
    errors.push(`Pass mark must be between 0 and ${COMPONENT_WEIGHT_TOTAL}.`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateAssessmentPlan(
  input: ValidateAssessmentPlanInput
): ValidationResult {
  const errors: string[] = [];
  const { scoreComponents, componentRules, gradingPolicyStatus, planStatus } =
    input;

  if (!scoreComponents.length) {
    errors.push("Assessment plan requires at least one grading policy component.");
  }

  const componentWeightTotal = scoreComponents.reduce(
    (sum, component) => sum + component.weight,
    0
  );

  if (Math.abs(componentWeightTotal - COMPONENT_WEIGHT_TOTAL) > 0.001) {
    errors.push(
      `Linked grading policy component weights must total ${COMPONENT_WEIGHT_TOTAL}, but total is ${componentWeightTotal}.`
    );
  }

  if (gradingPolicyStatus === "archived") {
    errors.push("Archived grading policies cannot be assigned to assessment plans.");
  }

  if (planStatus === "locked") {
    errors.push("Locked assessment plans cannot be edited.");
  }

  const componentKeys = new Set(scoreComponents.map((component) => component.key));
  const seenRuleKeys = new Set<string>();

  for (const rule of componentRules) {
    if (!componentKeys.has(rule.componentKey)) {
      errors.push(
        `Component rule "${rule.componentKey}" does not match any grading policy component.`
      );
    }

    if (seenRuleKeys.has(rule.componentKey)) {
      errors.push(`Duplicate component rule for "${rule.componentKey}".`);
    }
    seenRuleKeys.add(rule.componentKey);

    if (!MVP_CONTRIBUTION_MODES.includes(rule.contributionMode)) {
      errors.push(
        `Contribution mode "${rule.contributionMode}" is not supported in the MVP engine yet.`
      );
    }

    if (rule.contributionMode === "best_n" && (rule.bestN ?? 0) < 1) {
      errors.push(`Best N rule for "${rule.componentKey}" requires bestN >= 1.`);
    }

    if (
      rule.contributionMode === "teacher_selected" &&
      rule.minItems != null &&
      rule.maxItems != null &&
      rule.minItems > rule.maxItems
    ) {
      errors.push(
        `Teacher-selected rule for "${rule.componentKey}" has minItems greater than maxItems.`
      );
    }

    if (rule.contributionMode === "fixed_required_item") {
      const hasRequiredCriteria =
        (rule.requiredAssessmentTypes?.length ?? 0) > 0 ||
        (rule.requiredItemLabels?.length ?? 0) > 0;
      if (!hasRequiredCriteria) {
        errors.push(
          `Fixed required item rule for "${rule.componentKey}" must specify requiredAssessmentTypes or requiredItemLabels.`
        );
      }
    }
  }

  for (const component of scoreComponents) {
    if (!seenRuleKeys.has(component.key)) {
      errors.push(
        `Missing component rule for grading policy component "${component.key}".`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
