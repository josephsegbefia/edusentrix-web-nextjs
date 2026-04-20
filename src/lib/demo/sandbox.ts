import type { Types } from "mongoose";
import { DemoSandbox, type IDemoSandbox } from "@/models/DemoSandbox";
import { School } from "@/models/School";
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

  for (let attempt = 0; attempt < 5; attempt += 1) {
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

    if (!sandbox) return null;

    const schoolExists = await School.exists({ _id: sandbox.schoolId });
    if (schoolExists) return sandbox;

    await DemoSandbox.updateOne(
      { _id: sandbox._id },
      {
        $set: {
          state: "tainted",
          lastResetError:
            "Sandbox school record is missing. Re-seed this demo tenant.",
        },
      }
    );
  }

  return null;
}

/**
 * Release a sandbox back to the pool without destroying its seeded
 * school data. This keeps the demo environment usable between sessions.
 */
export async function releaseDemoSandbox(
  sandboxId: Types.ObjectId
): Promise<void> {
  await DemoSandbox.updateOne(
    { _id: sandboxId },
    {
      $set: {
        state: "available",
        allocatedSessionId: null,
        allocatedLeadId: null,
        allocatedAt: null,
        expiresAt: null,
        lastResetError: null,
      },
    }
  );
}
