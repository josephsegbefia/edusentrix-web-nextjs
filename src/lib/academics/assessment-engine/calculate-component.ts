import type {
  AssessmentScoreStatus,
  ComponentRule,
  ContributionMode,
  MissingScorePolicy,
  ScoreComponent,
  SubjectResultComponentSnapshot,
} from "@/types/academics/assessment-engine";

export type CalculationAssessmentItem = {
  id: string;
  componentKey?: string | null;
  assessmentType: string;
  title: string;
  maxScore: number;
  contributesToReport: boolean;
  contributionLockedByRule?: boolean;
  missingPolicy?: MissingScorePolicy;
};

export type CalculationAssessmentScore = {
  assessmentItemId: string;
  score: number | null;
  status?: AssessmentScoreStatus;
};

export type ComponentCalculationIssue = {
  code: string;
  message: string;
  severity: "warning" | "error";
  assessmentItemId?: string;
};

export type CalculateComponentInput = {
  component: ScoreComponent;
  rule: ComponentRule;
  items: CalculationAssessmentItem[];
  scores: CalculationAssessmentScore[];
  teacherSelectedItemIds?: string[];
};

export type CalculateComponentResult = SubjectResultComponentSnapshot & {
  issues: ComponentCalculationIssue[];
  blocked: boolean;
  missingRequiredItems: string[];
};

type ScoredItem = {
  item: CalculationAssessmentItem;
  score: number;
  percentage: number;
};

type ItemResolution = {
  scoredItems: ScoredItem[];
  excludedItemIds: string[];
  missingRequiredItems: string[];
  issues: ComponentCalculationIssue[];
  blocked: boolean;
};

function scoreMap(scores: CalculationAssessmentScore[]) {
  return new Map(scores.map((entry) => [entry.assessmentItemId, entry]));
}

function itemBelongsToComponent(
  item: CalculationAssessmentItem,
  component: ScoreComponent
): boolean {
  if (item.componentKey) {
    return item.componentKey === component.key;
  }

  if (component.allowedAssessmentTypes.length === 0) {
    return false;
  }

  return component.allowedAssessmentTypes.includes(item.assessmentType);
}

function getMissingPolicy(
  item: CalculationAssessmentItem
): MissingScorePolicy {
  return item.missingPolicy ?? "exclude_from_average";
}

function resolveItemScore(
  item: CalculationAssessmentItem,
  scoreEntry: CalculationAssessmentScore | undefined
): {
  kind: "scored" | "excluded" | "blocked";
  score?: number;
  percentage?: number;
  issue?: ComponentCalculationIssue;
} {
  const missingPolicy = getMissingPolicy(item);
  const rawScore = scoreEntry?.score;
  const isMissing =
    rawScore == null ||
    scoreEntry?.status === "missing" ||
    scoreEntry?.status === "draft";

  if (!isMissing) {
    const score = Math.max(0, rawScore);
    const percentage =
      item.maxScore > 0 ? (score / item.maxScore) * 100 : 0;
    return { kind: "scored", score, percentage };
  }

  if (missingPolicy === "block_submission") {
    return {
      kind: "blocked",
      issue: {
        code: "MISSING_SCORE_BLOCKS_SUBMISSION",
        message: `Missing score for "${item.title}" blocks submission.`,
        severity: "error",
        assessmentItemId: item.id,
      },
    };
  }

  if (missingPolicy === "count_as_zero") {
    return { kind: "scored", score: 0, percentage: 0 };
  }

  return { kind: "excluded" };
}

function aggregateAverageOfPercentages(scoredItems: ScoredItem[]) {
  const rawPercentage =
    scoredItems.reduce((sum, entry) => sum + entry.percentage, 0) /
    scoredItems.length;

  return {
    rawScore: rawPercentage,
    rawMaxScore: 100,
    rawPercentage,
  };
}

function aggregateWeightedByMaxScore(scoredItems: ScoredItem[]) {
  const rawScore = scoredItems.reduce((sum, entry) => sum + entry.score, 0);
  const rawMaxScore = scoredItems.reduce(
    (sum, entry) => sum + entry.item.maxScore,
    0
  );
  const rawPercentage = rawMaxScore > 0 ? (rawScore / rawMaxScore) * 100 : 0;

  return { rawScore, rawMaxScore, rawPercentage };
}

function buildSnapshot(
  component: ScoreComponent,
  rule: ComponentRule,
  includedIds: string[],
  excludedIds: string[],
  rawScore: number,
  rawMaxScore: number,
  rawPercentage: number
): SubjectResultComponentSnapshot {
  const weightedScore = (rawPercentage * component.weight) / 100;

  return {
    componentKey: component.key,
    label: component.label,
    weight: component.weight,
    rawScore,
    rawMaxScore,
    rawPercentage,
    weightedScore,
    includedAssessmentItemIds: includedIds,
    excludedAssessmentItemIds: excludedIds,
    calculationMode: rule.contributionMode,
  };
}

function emptyResult(
  component: ScoreComponent,
  rule: ComponentRule,
  issues: ComponentCalculationIssue[],
  blocked: boolean,
  missingRequiredItems: string[] = []
): CalculateComponentResult {
  return {
    ...buildSnapshot(component, rule, [], [], 0, 0, 0),
    issues,
    blocked,
    missingRequiredItems,
  };
}

function selectEligibleItems(
  component: ScoreComponent,
  rule: ComponentRule,
  items: CalculationAssessmentItem[],
  teacherSelectedItemIds?: string[]
): CalculationAssessmentItem[] {
  const eligible = items.filter((item) => itemBelongsToComponent(item, component));

  if (rule.contributionMode === "teacher_selected") {
    const selectedIds = new Set(teacherSelectedItemIds ?? []);
    return eligible.filter(
      (item) =>
        item.contributesToReport ||
        selectedIds.has(item.id) ||
        item.contributionLockedByRule
    );
  }

  if (rule.contributionMode === "fixed_required_item") {
    return eligible.filter((item) => {
      const matchesType =
        rule.requiredAssessmentTypes?.includes(item.assessmentType) ?? false;
      const matchesLabel =
        rule.requiredItemLabels?.includes(item.title) ?? false;
      return matchesType || matchesLabel;
    });
  }

  return eligible;
}

function resolveScoredItems(
  items: CalculationAssessmentItem[],
  scores: CalculationAssessmentScore[],
  options?: { requireAllItems?: boolean }
): ItemResolution {
  const scoresByItemId = scoreMap(scores);
  const scoredItems: ScoredItem[] = [];
  const excludedItemIds: string[] = [];
  const missingRequiredItems: string[] = [];
  const issues: ComponentCalculationIssue[] = [];
  let blocked = false;

  for (const item of items) {
    const resolution = resolveItemScore(item, scoresByItemId.get(item.id));

    if (resolution.kind === "blocked") {
      blocked = true;
      missingRequiredItems.push(item.id);
      if (resolution.issue) issues.push(resolution.issue);
      continue;
    }

    if (resolution.kind === "excluded") {
      excludedItemIds.push(item.id);
      if (options?.requireAllItems) {
        missingRequiredItems.push(item.id);
        issues.push({
          code: "MISSING_REQUIRED_ITEM",
          message: `Required item "${item.title}" is missing a score.`,
          severity: "error",
          assessmentItemId: item.id,
        });
      }
      continue;
    }

    scoredItems.push({
      item,
      score: resolution.score ?? 0,
      percentage: resolution.percentage ?? 0,
    });
  }

  return { scoredItems, excludedItemIds, missingRequiredItems, issues, blocked };
}

function applyBestN(scoredItems: ScoredItem[], bestN: number): ScoredItem[] {
  return [...scoredItems]
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, bestN);
}

function validateSelectionCount(
  rule: ComponentRule,
  includedCount: number
): ComponentCalculationIssue[] {
  const issues: ComponentCalculationIssue[] = [];

  if (rule.minItems != null && includedCount < rule.minItems) {
    issues.push({
      code: "INSUFFICIENT_SELECTED_ITEMS",
      message: `At least ${rule.minItems} contributing items are required, but only ${includedCount} qualify.`,
      severity: "error",
    });
  }

  if (rule.maxItems != null && includedCount > rule.maxItems) {
    issues.push({
      code: "TOO_MANY_SELECTED_ITEMS",
      message: `At most ${rule.maxItems} contributing items are allowed, but ${includedCount} qualify.`,
      severity: "error",
    });
  }

  return issues;
}

function aggregateByMode(
  mode: ContributionMode,
  scoredItems: ScoredItem[],
  rule: ComponentRule
) {
  if (mode === "weighted_items") {
    return aggregateWeightedByMaxScore(scoredItems);
  }

  if (mode === "best_n") {
    return aggregateAverageOfPercentages(scoredItems);
  }

  return aggregateAverageOfPercentages(scoredItems);
}

export function calculateComponent(
  input: CalculateComponentInput
): CalculateComponentResult {
  const { component, rule, items, scores, teacherSelectedItemIds } = input;
  const selectedItems = selectEligibleItems(
    component,
    rule,
    items,
    teacherSelectedItemIds
  );

  if (selectedItems.length === 0) {
    const issues: ComponentCalculationIssue[] = [];
    if (component.required) {
      issues.push({
        code: "MISSING_REQUIRED_COMPONENT",
        message: `Required component "${component.label}" has no eligible assessment items.`,
        severity: "error",
      });
    }

    return emptyResult(
      component,
      rule,
      issues,
      component.required,
      component.required ? [component.key] : []
    );
  }

  const requireAllItems = rule.contributionMode === "fixed_required_item";
  const resolution = resolveScoredItems(selectedItems, scores, {
    requireAllItems,
  });

  if (resolution.blocked) {
    return emptyResult(
      component,
      rule,
      resolution.issues,
      true,
      resolution.missingRequiredItems
    );
  }

  const selectionIssues =
    rule.contributionMode === "teacher_selected"
      ? validateSelectionCount(rule, resolution.scoredItems.length)
      : [];

  if (rule.contributionMode === "best_n") {
    const bestN = rule.bestN ?? 1;
    if (resolution.scoredItems.length < bestN) {
      selectionIssues.push({
        code: "INSUFFICIENT_BEST_N_ITEMS",
        message: `Best ${bestN} rule requires at least ${bestN} scored items, but only ${resolution.scoredItems.length} are available.`,
        severity: "error",
      });
    }
  }

  if (resolution.scoredItems.length === 0) {
    const issues = [...resolution.issues, ...selectionIssues];
    return emptyResult(
      component,
      rule,
      issues,
      issues.some((issue) => issue.severity === "error"),
      resolution.missingRequiredItems
    );
  }

  let scoredItemsForAggregate = resolution.scoredItems;
  if (rule.contributionMode === "best_n") {
    scoredItemsForAggregate = applyBestN(
      resolution.scoredItems,
      Math.max(1, rule.bestN ?? 1)
    );
  }

  const aggregate = aggregateByMode(
    rule.contributionMode,
    scoredItemsForAggregate,
    rule
  );

  const includedIds = scoredItemsForAggregate.map((entry) => entry.item.id);
  const excludedIds = [
    ...new Set([
      ...resolution.excludedItemIds,
      ...selectedItems
        .filter((item) => !includedIds.includes(item.id))
        .map((item) => item.id),
    ]),
  ];

  return {
    ...buildSnapshot(
      component,
      rule,
      includedIds,
      excludedIds,
      aggregate.rawScore,
      aggregate.rawMaxScore,
      aggregate.rawPercentage
    ),
    issues: [...resolution.issues, ...selectionIssues],
    blocked: selectionIssues.some((issue) => issue.severity === "error"),
    missingRequiredItems: resolution.missingRequiredItems,
  };
}

export function calculateWeightedScore(rawPercentage: number, weight: number) {
  return (rawPercentage * weight) / 100;
}
