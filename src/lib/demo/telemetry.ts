import { isDemoMode } from "./runtime";
import { DemoEvent } from "@/models/DemoEvent";
import type { Types } from "mongoose";

export type DemoTelemetryInput = {
  leadId?: Types.ObjectId | string | null;
  sessionId?: Types.ObjectId | string | null;
  sandboxId?: Types.ObjectId | string | null;
  schoolId?: Types.ObjectId | string | null;
  actorRole?: string | null;
  actorUserId?: Types.ObjectId | string | null;
  eventType: string;
  eventCode: string;
  metadata?: Record<string, unknown> | null;
};

/**
 * Write a demo telemetry event.  No-ops silently when demo mode is off
 * so callers don't need their own `isDemoMode()` guard.
 */
export async function trackDemoEvent(
  input: DemoTelemetryInput
): Promise<void> {
  if (!isDemoMode()) return;

  try {
    await DemoEvent.create({
      leadId: input.leadId || undefined,
      sessionId: input.sessionId || undefined,
      sandboxId: input.sandboxId || undefined,
      schoolId: input.schoolId || undefined,
      actorRole: input.actorRole || undefined,
      actorUserId: input.actorUserId || undefined,
      eventType: input.eventType,
      eventCode: input.eventCode,
      metadata: input.metadata || undefined,
    });
  } catch (err) {
    console.error("[demo-telemetry] Failed to write event:", err);
  }
}

/**
 * Standard event codes for the demo platform.
 */
export const DEMO_EVENT_CODES = {
  SESSION_STARTED: "session.started",
  SESSION_ENDED: "session.ended",
  SESSION_EXPIRED: "session.expired",
  PERSONA_SWITCHED: "persona.switched",
  ACTION_BLOCKED: "action.blocked",
  ACTION_SIMULATED: "action.simulated",
  PAGE_VIEWED: "page.viewed",
  FEATURE_EXPLORED: "feature.explored",
  LEAD_CAPTURED: "lead.captured",
  SANDBOX_ALLOCATED: "sandbox.allocated",
  SANDBOX_RELEASED: "sandbox.released",
  SANDBOX_RESET: "sandbox.reset",
} as const;
