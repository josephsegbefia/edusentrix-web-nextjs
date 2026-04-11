/**
 * CRM-lite pipeline for platform school applications (Phase 4).
 * Independent from approval `status`; when `stage` is unset on a document,
 * APIs infer a display stage from `status` for backwards compatibility.
 */
export const APPLICATION_PIPELINE_STAGES = [
  "lead",
  "qualified",
  "demo",
  "proposal",
  "closed_won",
  "closed_lost",
] as const;

export type ApplicationPipelineStage =
  (typeof APPLICATION_PIPELINE_STAGES)[number];

export function inferPipelineStageFromStatus(
  status: "submitted" | "reviewed" | "approved" | "rejected"
): ApplicationPipelineStage {
  switch (status) {
    case "submitted":
      return "lead";
    case "reviewed":
      return "qualified";
    case "approved":
      return "closed_won";
    case "rejected":
      return "closed_lost";
    default:
      return "lead";
  }
}

export const PIPELINE_STAGE_LABELS: Record<ApplicationPipelineStage, string> = {
  lead: "Lead",
  qualified: "Qualified",
  demo: "Demo",
  proposal: "Proposal",
  closed_won: "Closed — won",
  closed_lost: "Closed — lost",
};

/** Effective stage for API responses when `stage` was never persisted. */
export function resolveEffectivePipelineStage(doc: {
  stage?: ApplicationPipelineStage | null;
  status: "submitted" | "reviewed" | "approved" | "rejected";
}): ApplicationPipelineStage {
  if (doc.stage) return doc.stage;
  return inferPipelineStageFromStatus(doc.status);
}

/**
 * Matches legacy documents (no `stage`) by inferring from `status`, and explicit `stage` values.
 */
export function buildPipelineStageMongoFilter(
  stage: string | null | undefined
): Record<string, unknown> | undefined {
  if (!stage || stage === "all") return undefined;
  if (!APPLICATION_PIPELINE_STAGES.includes(stage as ApplicationPipelineStage))
    return undefined;
  const s = stage as ApplicationPipelineStage;
  switch (s) {
    case "lead":
      return {
        $or: [
          { stage: "lead" },
          { stage: { $exists: false }, status: "submitted" },
        ],
      };
    case "qualified":
      return {
        $or: [
          { stage: "qualified" },
          { stage: { $exists: false }, status: "reviewed" },
        ],
      };
    case "demo":
      return { stage: "demo" };
    case "proposal":
      return { stage: "proposal" };
    case "closed_won":
      return {
        $or: [
          { stage: "closed_won" },
          { stage: { $exists: false }, status: "approved" },
        ],
      };
    case "closed_lost":
      return {
        $or: [
          { stage: "closed_lost" },
          { stage: { $exists: false }, status: "rejected" },
        ],
      };
    default:
      return undefined;
  }
}
