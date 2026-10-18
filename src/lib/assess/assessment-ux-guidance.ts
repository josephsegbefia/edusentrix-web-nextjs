export type AssessWorkflowFocus =
  | "paper-delivery"
  | "packets"
  | "assignments"
  | "evidence"
  | "marking"
  | "approved-results";

export const PAPER_WORKFLOW_STEPS = [
  {
    id: "paper-delivery",
    label: "Prepare paper",
    shortLabel: "Prepare",
    description: "Choose an examination and publish its paper version.",
  },
  {
    id: "packets",
    label: "Print papers",
    shortLabel: "Print",
    description: "Generate secure printable papers without candidate identity.",
  },
  {
    id: "assignments",
    label: "Assign students",
    shortLabel: "Assign",
    description: "Match issued papers to eligible students.",
  },
  {
    id: "evidence",
    label: "Review scans",
    shortLabel: "Review scans",
    description: "Resolve missing or unverified script pages.",
  },
  {
    id: "marking",
    label: "Mark and review",
    shortLabel: "Mark",
    description: "Assign marking, moderate submissions and approve outcomes.",
  },
  {
    id: "approved-results",
    label: "Send marks",
    shortLabel: "Send marks",
    description: "Send approved marks to the Core Gradebook explicitly.",
  },
] as const satisfies ReadonlyArray<{
  id: AssessWorkflowFocus;
  label: string;
  shortLabel: string;
  description: string;
}>;

export type AssessAccessBlocker = {
  kind:
    | "school-not-active"
    | "premium-plan"
    | "premium-not-enabled"
    | "subscription-mode"
    | "access-unavailable";
  eyebrow: string;
  title: string;
  explanation: string;
  resolution: string;
};

export function describeAssessAccessBlocker(
  reason: string | null | undefined,
): AssessAccessBlocker {
  const normalized = reason?.toLowerCase() ?? "";

  if (normalized.includes("requires an active school")) {
    return {
      kind: "school-not-active",
      eyebrow: "School setup required",
      title: "This school is not active yet",
      explanation:
        "Premium Assess is unavailable until the selected school is marked active in School OS. Your school selection and administrator access are separate from the school lifecycle status.",
      resolution:
        "Ask a platform administrator to activate this school. You can continue creating ordinary Core examinations while that is resolved.",
    };
  }

  if (normalized.includes("enterprise entitlement")) {
    return {
      kind: "premium-plan",
      eyebrow: "Premium access required",
      title: "Premium Assess is not included in this school plan",
      explanation:
        "The selected school is available, but its current subscription does not include the Premium publication capability.",
      resolution:
        "Ask the school subscription administrator to confirm the approved Premium package. Core examinations remain available.",
    };
  }

  if (normalized.includes("enforcement is not enabled")) {
    return {
      kind: "premium-not-enabled",
      eyebrow: "Premium access is not enabled",
      title: "Premium Assess is not enabled for this environment",
      explanation:
        "The server is correctly refusing Premium publication while subscription enforcement is disabled or incomplete.",
      resolution:
        "Ask the platform operator to complete the approved subscription-enforcement setup. Do not retry by changing client settings.",
    };
  }

  if (normalized.includes("access mode")) {
    return {
      kind: "subscription-mode",
      eyebrow: "Premium access is restricted",
      title: "This school is currently in a restricted subscription mode",
      explanation:
        "Premium publication is unavailable in the selected school’s current subscription access mode.",
      resolution:
        "Ask the school subscription administrator to review the school’s approved access mode. Core examinations remain available.",
    };
  }

  return {
    kind: "access-unavailable",
    eyebrow: "Assess access unavailable",
    title: "Premium Assess is unavailable for this school",
    explanation:
      reason ||
      "The server could not confirm the school’s Premium Assess entitlement for this session.",
    resolution:
      "Refresh once. If the problem continues, ask a school or platform administrator to review the selected school and subscription access.",
  };
}

export function hasAssessActivity(data: {
  metrics: Record<string, number>;
  attention: unknown[];
  recentExaminations: unknown[];
}) {
  return (
    Object.values(data.metrics).some((value) => value > 0) ||
    data.attention.length > 0 ||
    data.recentExaminations.length > 0
  );
}
