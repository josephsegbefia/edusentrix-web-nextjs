import "server-only";
import mongoose from "mongoose";
import { recordActivity } from "@/lib/audit/recordActivity";
import type { ActivityType } from "@/models/Activity";

const ACTION_MAP: Record<string, ActivityType> = {
  approved: "scheme.review.approved",
  needs_revision: "scheme.review.revision_requested",
  rejected: "scheme.review.rejected",
  activated: "scheme.activated",
  archived: "scheme.archived",
};

export async function recordSchemeReviewAudit(input: {
  schoolId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  schemeId: mongoose.Types.ObjectId;
  action: "approved" | "needs_revision" | "rejected" | "activated" | "archived";
  previousStatus: string;
  nextStatus: string;
  note?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const type = ACTION_MAP[input.action];
  if (!type) return;
  try {
    await recordActivity({
      schoolId: input.schoolId,
      userId: input.userId,
      type,
      entityType: "SchemeOfWork",
      entityId: input.schemeId,
      description: `Scheme ${input.action.replace(/_/g, " ")} (${input.previousStatus} → ${input.nextStatus})`,
      metadata: {
        schemeId: String(input.schemeId),
        previousStatus: input.previousStatus,
        nextStatus: input.nextStatus,
        note: input.note ?? undefined,
        ...input.metadata,
      },
    });
  } catch (e) {
    console.error("[scheme-review-audit]", e);
  }
}
