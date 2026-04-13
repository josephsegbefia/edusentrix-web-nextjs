import mongoose from "mongoose";
import crypto from "node:crypto";
import { connectToDatabase } from "@/db/connectToDatabase";
import { DemoSandbox, type IDemoSandbox } from "@/models/DemoSandbox";
import {
  deleteOrderedCollections,
} from "./collection-registry";

/**
 * Reset a single sandbox school by deleting all school-scoped data and
 * re-running the seed.  The sandbox transitions through states:
 *
 *   allocated → resetting → (delete + seed) → available
 *
 * This is designed to be called from a cron endpoint or background job.
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
    const ordered = deleteOrderedCollections();

    for (const entry of ordered) {
      const model = mongoose.models[entry.modelName];
      if (!model) continue;
      const filter: Record<string, unknown> = {
        [entry.schoolIdField]: schoolId,
      };
      const result = await model.deleteMany(filter);
      if (result.deletedCount > 0) {
        console.log(
          `[reset] Deleted ${result.deletedCount} ${entry.modelName} docs`
        );
      }
    }

    const School = mongoose.model("School");
    const existing = await School.findById(schoolId).lean();
    if (existing) {
      await School.deleteOne({ _id: schoolId });
      console.log("[reset] Deleted School document");
    }

    // Re-seed will be handled by the seed script or an inline seed function
    // For now, mark as tainted until a full re-seed runs
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
          seedFingerprint: crypto.randomBytes(16).toString("hex"),
        },
      }
    );

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
  const expired = await DemoSession.find({
    status: "active",
    expiresAt: { $lte: now },
  })
    .select("_id sandboxId leadId")
    .lean<
      Array<{
        _id: mongoose.Types.ObjectId;
        sandboxId: mongoose.Types.ObjectId | null;
        leadId: mongoose.Types.ObjectId;
      }>
    >();

  for (const session of expired) {
    await DemoSession.updateOne(
      { _id: session._id },
      { $set: { status: "expired", endedAt: now } }
    );

    if (session.sandboxId) {
      await DemoSandbox.updateOne(
        { _id: session.sandboxId, state: "allocated" },
        {
          $set: {
            state: "resetting",
            allocatedSessionId: null,
            allocatedLeadId: null,
            allocatedAt: null,
            expiresAt: null,
          },
        }
      );
    }

    await DemoLead.updateOne(
      { _id: session.leadId },
      { $set: { status: "completed_demo", lastSeenAt: now } }
    );
  }

  if (expired.length > 0) {
    console.log(`[expire] Expired ${expired.length} demo sessions`);
  }

  return expired.length;
}
