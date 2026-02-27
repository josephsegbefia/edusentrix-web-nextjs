// src/lib/promotions/logging.ts
// PROMO-BE-008: Structured logging for promotion operations
import type { Types } from "mongoose";

export type PromotionLogContext = {
  schoolId: Types.ObjectId;
  cycleId?: Types.ObjectId;
  studentId?: Types.ObjectId;
  action: string;
  [key: string]: unknown;
};

/**
 * Structured log for promotion operations. Use for observability and debugging.
 * Does not throw; failures are logged to console.
 */
export function logPromotionEvent(context: PromotionLogContext): void {
  try {
    const payload: Record<string, unknown> = {
      ...context,
      schoolId: String(context.schoolId),
      cycleId: context.cycleId ? String(context.cycleId) : undefined,
      studentId: context.studentId ? String(context.studentId) : undefined,
      timestamp: new Date().toISOString(),
    };
    console.log("[PROMOTION]", JSON.stringify(payload));
  } catch {
    // Never fail main flow
  }
}
