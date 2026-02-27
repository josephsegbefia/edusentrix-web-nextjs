// src/lib/promotions/recordPromotionActivity.ts
// PROMO-BE-008: Promotion activity logging - does not fail main flow
import { recordActivity } from "@/lib/audit/recordActivity";
import type { Types } from "mongoose";

export type PromotionActivityType =
  | "promotion.policy.created"
  | "promotion.policy.activated"
  | "promotion.cycle.preview_ready"
  | "promotion.cycle.approved"
  | "promotion.cycle.finalize_started"
  | "promotion.cycle.finalized"
  | "promotion.cycle.finalize_failed"
  | "promotion.cycle.rollback_started"
  | "promotion.cycle.rolled_back"
  | "promotion.cycle.rollback_failed"
  | "promotion.decision.override"
  | "promotion.decision.placement";

type Params = {
  schoolId: Types.ObjectId;
  userId: Types.ObjectId;
  type: PromotionActivityType;
  entityType?: string;
  entityId?: Types.ObjectId;
  description: string;
  metadata?: Record<string, unknown>;
};

export async function recordPromotionActivity(params: Params): Promise<void> {
  try {
    await recordActivity({
      schoolId: params.schoolId,
      userId: params.userId,
      type: params.type,
      entityType: params.entityType,
      entityId: params.entityId,
      description: params.description,
      metadata: params.metadata,
    });
  } catch {
    // recordActivity already swallows; double safety
  }
}
