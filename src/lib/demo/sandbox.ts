import type { Types } from "mongoose";
import { DemoSandbox, type IDemoSandbox } from "@/models/DemoSandbox";
import { DEMO_CONFIG } from "./runtime";

/**
 * Atomically allocate the oldest available sandbox to the given lead.
 *
 * Uses `findOneAndUpdate` so no two concurrent requests can grab the
 * same sandbox.  Returns `null` when the pool is exhausted.
 */
export async function allocateDemoSandbox(
  leadId: Types.ObjectId
): Promise<IDemoSandbox | null> {
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + DEMO_CONFIG.defaultSessionMinutes * 60_000
  );

  const sandbox = await DemoSandbox.findOneAndUpdate(
    { state: "available" },
    {
      $set: {
        state: "allocated",
        allocatedLeadId: leadId,
        allocatedAt: now,
        expiresAt,
      },
    },
    { sort: { lastResetAt: 1 }, new: true }
  ).lean<IDemoSandbox>();

  return sandbox ?? null;
}

/**
 * Release a sandbox back to the pool by marking it for reset.
 * The reset worker picks up sandboxes in `resetting` state.
 */
export async function releaseDemoSandbox(
  sandboxId: Types.ObjectId
): Promise<void> {
  await DemoSandbox.updateOne(
    { _id: sandboxId, state: "allocated" },
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
