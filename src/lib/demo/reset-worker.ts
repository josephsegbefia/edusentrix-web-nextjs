import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { DemoSandbox, type IDemoSandbox } from "@/models/DemoSandbox";
import { DEMO_CONFIG } from "./runtime";
import { releaseDemoSandbox } from "./sandbox";
import { trackDemoEvent, DEMO_EVENT_CODES } from "./telemetry";

/**
 * Soft-reset a sandbox back to `available` without deleting its seeded
 * school data. The demo environment relies on stable, preloaded content.
 */
export async function resetSandbox(
  sandboxId: mongoose.Types.ObjectId
): Promise<{ ok: boolean; durationMs: number; error?: string }> {
  const start = Date.now();

  await connectToDatabase();

  const sandbox = await DemoSandbox.findOneAndUpdate(
    { _id: sandboxId, state: "resetting" },
    { $set: { state: "resetting" } },
    { new: true }
  ).lean<IDemoSandbox>();

  if (!sandbox) {
    return { ok: false, durationMs: 0, error: "Sandbox not in resetting state" };
  }

  const { schoolId } = sandbox;

  try {
    const durationMs = Date.now() - start;

    await DemoSandbox.updateOne(
      { _id: sandboxId },
      {
        $set: {
          state: "available",
          allocatedSessionId: null,
          allocatedLeadId: null,
          allocatedAt: null,
          expiresAt: null,
          lastResetAt: new Date(),
          lastResetDurationMs: durationMs,
          lastResetError: null,
        },
      }
    );

    await trackDemoEvent({
      sandboxId,
      schoolId,
      eventType: "sandbox",
      eventCode: DEMO_EVENT_CODES.SANDBOX_RESET,
      metadata: { mode: "soft_reset" },
    });

    console.log(`[reset] Sandbox ${sandboxId} reset in ${durationMs}ms`);
    return { ok: true, durationMs };
  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMsg =
      err instanceof Error ? err.message : "Unknown reset error";

    await DemoSandbox.updateOne(
      { _id: sandboxId },
      {
        $set: {
          state: "tainted",
          lastResetDurationMs: durationMs,
          lastResetError: errorMsg,
        },
      }
    );

    console.error(`[reset] Sandbox ${sandboxId} failed:`, errorMsg);
    return { ok: false, durationMs, error: errorMsg };
  }
}

/**
 * Process all sandboxes in `resetting` state.
 * Called from the cron endpoint.
 */
export async function processResetQueue(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  await connectToDatabase();

  const pending = await DemoSandbox.find({ state: "resetting" })
    .select("_id")
    .lean<Array<{ _id: mongoose.Types.ObjectId }>>();

  let succeeded = 0;
  let failed = 0;

  for (const s of pending) {
    const result = await resetSandbox(s._id);
    if (result.ok) succeeded++;
    else failed++;
  }

  return { processed: pending.length, succeeded, failed };
}

/**
 * Expire sessions that have exceeded their TTL and release their sandboxes.
 */
export async function expireStaleSessions(): Promise<number> {
  await connectToDatabase();

  const { DemoSession } = await import("@/models/DemoSession");
  const { DemoLead } = await import("@/models/DemoLead");

  const now = new Date();
  const idleCutoff = new Date(
    now.getTime() - DEMO_CONFIG.idleTimeoutMinutes * 60_000
  );
  const expired = await DemoSession.find({
    status: "active",
    $or: [
      { expiresAt: { $lte: now } },
      { lastInteractionAt: { $lte: idleCutoff } },
    ],
  })
    .select(
      "_id sandboxId sandboxSchoolId leadId activePersonaRole expiresAt lastInteractionAt"
    )
    .lean<
      Array<{
        _id: mongoose.Types.ObjectId;
        sandboxId: mongoose.Types.ObjectId | null;
        sandboxSchoolId: mongoose.Types.ObjectId | null;
        leadId: mongoose.Types.ObjectId;
        activePersonaRole: string | null;
        expiresAt: Date;
        lastInteractionAt?: Date | null;
      }>
    >();

  for (const session of expired) {
    const isIdleExpired =
      Boolean(session.lastInteractionAt) &&
      new Date(session.lastInteractionAt as Date).getTime() <=
        idleCutoff.getTime();

    await DemoSession.updateOne(
      { _id: session._id },
      {
        $set: {
          status: isIdleExpired ? "abandoned" : "expired",
          endedAt: now,
        },
      }
    );

    await DemoLead.updateOne(
      { _id: session.leadId },
      {
        $set: {
          status: "completed_demo",
          lastSeenAt: now,
        },
      }
    );

    if (session.sandboxId) {
      await releaseDemoSandbox(session.sandboxId);
    }

    await trackDemoEvent({
      leadId: session.leadId,
      sessionId: session._id,
      sandboxId: session.sandboxId,
      schoolId: session.sandboxSchoolId,
      actorRole: session.activePersonaRole,
      eventType: "session",
      eventCode: DEMO_EVENT_CODES.SESSION_EXPIRED,
      metadata: {
        reason: isIdleExpired ? "idle_timeout" : "session_expired",
      },
    });
  }

  if (expired.length > 0) {
    console.log(`[expire] Expired ${expired.length} demo sessions`);
  }

  return expired.length;
}
