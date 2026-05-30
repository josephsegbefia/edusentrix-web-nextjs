import type {
  ComponentRule,
  GradeBoundary,
  RoundingRule,
  ScoreComponent,
  SubjectResultComponentSnapshot,
} from "@/types/academics/assessment-engine";
import {
  calculateComponent,
  type CalculationAssessmentItem,
  type CalculationAssessmentScore,
  type ComponentCalculationIssue,
} from "@/lib/academics/assessment-engine/calculate-component";
import {
  applyRoundingRule,
  resolveGradeBoundary,
  resolvePassStatus,
} from "@/lib/academics/assessment-engine/resolve-grade-boundary";

export type CalculateSubjectResultInput = {
  scoreComponents: ScoreComponent[];
  componentRules: ComponentRule[];
  items: CalculationAssessmentItem[];
  scores: CalculationAssessmentScore[];
  teacherSelectedItemIdsByComponent?: Record<string, string[]>;
  gradeBoundaries: GradeBoundary[];
  passMark: number;
  roundingRule: RoundingRule;
};

export type CalculateSubjectResultOutput = {
  components: SubjectResultComponentSnapshot[];
  finalScore: number;
  roundedFinalScore: number;
  gradeLabel: string;
  gradePoint: number | null;
  descriptor: string | null;
  isPassed: boolean;
  missingRequiredItems: string[];
  sourceAssessmentItemIds: string[];
  issues: ComponentCalculationIssue[];
  blocked: boolean;
};

function ruleForComponent(
  componentKey: string,
  rules: ComponentRule[]
): ComponentRule {
  const existing = rules.find((rule) => rule.componentKey === componentKey);
  if (existing) return existing;

  return {
    componentKey,
    contributionMode: "average_all",
  };
}

export function calculateSubjectResult(
  input: CalculateSubjectResultInput
): CalculateSubjectResultOutput {
  const {
    scoreComponents,
    componentRules,
    items,
    scores,
    teacherSelectedItemIdsByComponent,
    gradeBoundaries,
    passMark,
    roundingRule,
  } = input;

  const sortedComponents = [...scoreComponents].sort(
    (a, b) => a.order - b.order
  );

  const componentResults = sortedComponents.map((component) =>
    calculateComponent({
      component,
      rule: ruleForComponent(component.key, componentRules),
      items,
      scores,
      teacherSelectedItemIds:
        teacherSelectedItemIdsByComponent?.[component.key],
    })
  );

  const finalScore = componentResults.reduce(
    (sum, component) => sum + component.weightedScore,
    0
  );
  const roundedFinalScore = applyRoundingRule(finalScore, roundingRule);
  const resolvedGrade = resolveGradeBoundary(roundedFinalScore, gradeBoundaries);

  const missingRequiredItems = [
    ...new Set(
      componentResults.flatMap((component) => component.missingRequiredItems)
    ),
  ];

  const sourceAssessmentItemIds = [
    ...new Set(
      componentResults.flatMap((component) => component.includedAssessmentItemIds)
    ),
  ];

  const issues = componentResults.flatMap((component) => component.issues);
  const blocked = componentResults.some((component) => component.blocked);

  for (const component of sortedComponents) {
    if (!component.required) continue;
    const result = componentResults.find(
      (entry) => entry.componentKey === component.key
    );
    if (!result || result.includedAssessmentItemIds.length === 0) {
      issues.push({
        code: "MISSING_REQUIRED_COMPONENT",
        message: `Required component "${component.label}" has no contributing scores.`,
        severity: "error",
      });
    }
  }

  return {
    components: componentResults.map(
      ({
        issues: _issues,
        blocked: _blocked,
        missingRequiredItems: _missingRequiredItems,
        ...snapshot
      }) => snapshot
    ),
    finalScore,
    roundedFinalScore,
    gradeLabel: resolvedGrade?.gradeLabel ?? "",
    gradePoint: resolvedGrade?.gradePoint ?? null,
    descriptor: resolvedGrade?.descriptor ?? null,
    isPassed: resolvePassStatus(
      roundedFinalScore,
      passMark,
      resolvedGrade
    ),
    missingRequiredItems,
    sourceAssessmentItemIds,
    issues,
    blocked: blocked || issues.some((issue) => issue.severity === "error"),
  };
}
