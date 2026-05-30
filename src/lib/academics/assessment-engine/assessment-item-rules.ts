import type {
  AcademicGradingPolicyDTO,
  AssessmentPlanDTO,
  ComponentRule,
  ContributionMode,
  TeacherGradebookComponentItemSummary,
  TeacherGradebookComponentSummary,
} from "@/types/academics/assessment-engine";

export function ruleForComponent(
  componentKey: string,
  rules: ComponentRule[]
): ComponentRule {
  return (
    rules.find((rule) => rule.componentKey === componentKey) ?? {
      componentKey,
      contributionMode: "average_all",
    }
  );
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

export function getAllowedAssessmentTypes(
  componentKey: string | null | undefined,
  policy: AcademicGradingPolicyDTO
) {
  if (!componentKey) {
    return policy.scoreComponents.flatMap((component) => component.allowedAssessmentTypes);
  }

  const component = policy.scoreComponents.find((entry) => entry.key === componentKey);
  if (!component || component.allowedAssessmentTypes.length === 0) {
    return null;
  }

  return component.allowedAssessmentTypes;
}

export function getComponentContributionUi(input: {
  componentKey: string;
  assessmentType: string;
  title: string;
  requestedContributesToReport: boolean;
  assessmentPlan: AssessmentPlanDTO;
}): {
  mode: ContributionMode;
  canToggleContribution: boolean;
  contributionLockedByRule: boolean;
  contributesToReport: boolean;
  helpText: string;
} {
  const rule = ruleForComponent(input.componentKey, input.assessmentPlan.componentRules);

  if (rule.contributionMode === "fixed_required_item") {
    const locked = matchesFixedRequiredItem(input.assessmentType, input.title.trim(), rule);
    return {
      mode: rule.contributionMode,
      canToggleContribution: false,
      contributionLockedByRule: locked,
      contributesToReport: locked,
      helpText: locked
        ? "This item matches the required exam rule and counts automatically."
        : "Set the assessment type or title to match the required fixed item rule.",
    };
  }

  if (rule.contributionMode === "teacher_selected") {
    if (!input.assessmentPlan.teacherCanMarkItemsAsReportContributing) {
      return {
        mode: rule.contributionMode,
        canToggleContribution: false,
        contributionLockedByRule: false,
        contributesToReport: false,
        helpText: "This plan does not allow teachers to mark report contributions.",
      };
    }

    return {
      mode: rule.contributionMode,
      canToggleContribution: true,
      contributionLockedByRule: false,
      contributesToReport: input.requestedContributesToReport,
      helpText: "Choose whether this item counts toward the report card for this component.",
    };
  }

  return {
    mode: rule.contributionMode,
    canToggleContribution: false,
    contributionLockedByRule: false,
    contributesToReport: false,
    helpText: "Contribution is managed automatically by the component rule.",
  };
}

export function humanizeAssessmentType(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMinMaxRule(rule: ComponentRule): string {
  if (rule.minItems != null && rule.maxItems != null) {
    return `Select between ${rule.minItems} and ${rule.maxItems} items.`;
  }
  if (rule.minItems != null) {
    return `Select at least ${rule.minItems} item${rule.minItems === 1 ? "" : "s"}.`;
  }
  if (rule.maxItems != null) {
    return `Select at most ${rule.maxItems} item${rule.maxItems === 1 ? "" : "s"}.`;
  }
  return "";
}

function buildFixedItemExclusionExplanation(
  rule: ComponentRule,
  item: TeacherGradebookComponentItemSummary
): string {
  const parts: string[] = [];
  if (rule.requiredAssessmentTypes?.length) {
    parts.push(
      `requires type ${rule.requiredAssessmentTypes.map(humanizeAssessmentType).join(" or ")}`
    );
  }
  if (rule.requiredItemLabels?.length) {
    parts.push(`requires title "${rule.requiredItemLabels.join('" or "')}"`);
  }
  if (parts.length === 0) {
    return "Does not match the fixed required item rule.";
  }
  return `Does not match the rule (${parts.join("; ")}). Current: ${humanizeAssessmentType(item.assessmentType)} · "${item.title}".`;
}

export function getComponentContributionModeExplanation(input: {
  contributionMode: ContributionMode;
  rule: ComponentRule;
  contributingItemCount: number;
  eligibleItemCount: number;
  assessmentPlan: AssessmentPlanDTO | null;
}): string {
  const { contributionMode, rule, contributingItemCount, eligibleItemCount, assessmentPlan } =
    input;

  switch (contributionMode) {
    case "teacher_selected": {
      const minMax = formatMinMaxRule(rule);
      const permission = assessmentPlan?.teacherCanMarkItemsAsReportContributing
        ? "Choose which eligible items count toward the report card."
        : "Teachers cannot change contributions on this plan.";
      const selection = `${contributingItemCount} of ${eligibleItemCount} item${eligibleItemCount === 1 ? "" : "s"} selected.`;
      return [permission, minMax, selection].filter(Boolean).join(" ");
    }
    case "average_all":
      return `All ${eligibleItemCount} eligible item${eligibleItemCount === 1 ? "" : "s"} are averaged automatically. You cannot change which items count.`;
    case "best_n": {
      const n = rule.bestN ?? 1;
      return `The system uses the best ${n} mark${n === 1 ? "" : "s"} from eligible items when calculating this component.`;
    }
    case "fixed_required_item":
      return "Only items matching the required assessment type or title count toward this component.";
    case "weighted_items":
      return "Each eligible item contributes proportionally based on its max score.";
    default:
      return "Contribution is managed automatically by the component rule.";
  }
}

export function getItemContributionDisplay(input: {
  item: TeacherGradebookComponentItemSummary;
  component: Pick<TeacherGradebookComponentSummary, "contributionMode" | "rule" | "label">;
  assessmentPlan: AssessmentPlanDTO | null;
  canRecord: boolean;
}): {
  status: "included" | "excluded" | "locked";
  statusLabel: string;
  explanation: string;
  canToggle: boolean;
  switchChecked: boolean;
} {
  const { item, component, assessmentPlan, canRecord } = input;
  const { contributionMode, rule } = component;

  if (contributionMode === "teacher_selected") {
    if (item.contributionLockedByRule) {
      return {
        status: "locked",
        statusLabel: "Locked",
        explanation: "This item is locked by plan rules and always counts.",
        canToggle: false,
        switchChecked: true,
      };
    }

    const canToggle =
      Boolean(assessmentPlan?.teacherCanMarkItemsAsReportContributing) &&
      canRecord &&
      item.status !== "archived" &&
      item.status !== "locked";

    if (item.includedByRule) {
      return {
        status: "included",
        statusLabel: "Included",
        explanation: canToggle
          ? "Counts toward this component on the report card."
          : item.status === "archived"
            ? "Selected, but archived items cannot be changed here."
            : "Selected for report contribution.",
        canToggle,
        switchChecked: true,
      };
    }

    return {
      status: "excluded",
      statusLabel: "Excluded",
      explanation: canToggle
        ? "Not selected. Turn on to include this item in the report."
        : item.status === "archived"
          ? "Archived items cannot be selected for report contribution."
          : "Not selected for report contribution.",
      canToggle,
      switchChecked: false,
    };
  }

  if (contributionMode === "fixed_required_item") {
    if (item.includedByRule) {
      return {
        status: item.contributionLockedByRule ? "locked" : "included",
        statusLabel: item.contributionLockedByRule ? "Required" : "Included",
        explanation: item.contributionLockedByRule
          ? "Matches the required item rule and counts automatically."
          : "Matches the required assessment type or title for this component.",
        canToggle: false,
        switchChecked: true,
      };
    }

    return {
      status: "excluded",
      statusLabel: "Excluded",
      explanation: buildFixedItemExclusionExplanation(rule, item),
      canToggle: false,
      switchChecked: false,
    };
  }

  if (item.includedByRule) {
    let explanation = "Eligible and included by the component rule.";
    if (contributionMode === "best_n") {
      explanation = `Eligible for calculation. Top ${rule.bestN ?? 1} scored item(s) are used at report time.`;
    } else if (contributionMode === "average_all") {
      explanation = "Included automatically when a score is recorded.";
    } else if (contributionMode === "weighted_items") {
      explanation = "Weight follows this item's max score relative to other eligible items.";
    }

    return {
      status: "included",
      statusLabel: "Included",
      explanation,
      canToggle: false,
      switchChecked: true,
    };
  }

  return {
    status: "excluded",
    statusLabel: "Excluded",
    explanation: "This item does not belong to this component.",
    canToggle: false,
    switchChecked: false,
  };
}
