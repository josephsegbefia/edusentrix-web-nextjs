/**
 * recordSubscriptionEvent
 *
 * Central helper for writing SubscriptionEvents.
 * Respects the SUBSCRIPTION_AUDIT_LOGS_ENABLED env flag.
 *
 * - When the flag is false, usage_event and entitlement_audit events are suppressed
 *   (they are high-volume and only useful when audit logging is intentionally on).
 * - All other event types (state changes, admin actions) are written unconditionally
 *   because they are critical for the subscription lifecycle audit trail.
 *
 * Usage:
 *   await recordSubscriptionEvent({
 *     schoolId,
 *     subscriptionId,
 *     eventType: "subscription_assigned",
 *     actorEmail,
 *     summary: "...",
 *     metadata: { ... },
 *   });
 *
 * Spec §17.
 */

import mongoose from "mongoose";
import { SubscriptionEvent, type SubscriptionEventType } from "@/models/SubscriptionEvent";

const HIGH_VOLUME_EVENT_TYPES: SubscriptionEventType[] = ["usage_event", "entitlement_audit"];

type RecordEventInput = {
  schoolId: mongoose.Types.ObjectId | string;
  subscriptionId?: mongoose.Types.ObjectId | string | null;
  eventType: SubscriptionEventType;
  actorId?: mongoose.Types.ObjectId | string | null;
  actorEmail?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
};

export async function recordSubscriptionEvent(input: RecordEventInput): Promise<void> {
  const auditEnabled = process.env.SUBSCRIPTION_AUDIT_LOGS_ENABLED === "true";

  // High-volume events are suppressed unless audit logging is explicitly enabled.
  if (!auditEnabled && HIGH_VOLUME_EVENT_TYPES.includes(input.eventType)) {
    return;
  }

  try {
    await SubscriptionEvent.create({
      schoolId:
        typeof input.schoolId === "string"
          ? new mongoose.Types.ObjectId(input.schoolId)
          : input.schoolId,
      subscriptionId: input.subscriptionId
        ? typeof input.subscriptionId === "string"
          ? new mongoose.Types.ObjectId(input.subscriptionId)
          : input.subscriptionId
        : null,
      eventType: input.eventType,
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail ?? null,
      summary: input.summary,
      metadata: input.metadata ?? null,
    });
  } catch (err) {
    // Audit failures must never crash the caller.
    console.error("[recordSubscriptionEvent] Failed to write event:", input.eventType, err);
  }
}
