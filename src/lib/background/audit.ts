import "server-only";

import { randomUUID } from "crypto";
import type { Types } from "mongoose";
import { writeRetryableAuditEvent } from "@/lib/audit/writeRetryableAuditEvent";
import type { IBackgroundJob } from "@/models/BackgroundJob";
import type { BackgroundJobActor } from "./authorization";

export async function writeBackgroundJobAudit(input: {
  actionCode:
    | "background.job.redispatched"
    | "background.job.retried"
    | "background.job.cancel_requested"
    | "background.job.recovery_action";
  actor?: BackgroundJobActor | null;
  job: IBackgroundJob;
  extra?: Record<string, unknown>;
  result?: "succeeded" | "failed" | "skipped";
}) {
  try {
    await writeRetryableAuditEvent({
      actionCode: input.actionCode,
      scopeType: input.job.schoolId ? "school" : "platform",
      scopeId: input.job.schoolId ? String(input.job.schoolId) : null,
      result: input.result ?? "succeeded",
      target: {
        targetEntityType: "BackgroundJob",
        targetEntityId: input.job._id,
      },
      context: {
        requestId: randomUUID(),
        correlationId: String(input.job._id),
        actorType: input.actor ? "user" : "job",
        actorId: input.actor?.userId ?? null,
        schoolId: input.job.schoolId ?? input.actor?.schoolId ?? null,
        routePath: "background-work",
      },
      payload: {
        metadata: {
          jobId: String(input.job._id),
          kind: input.job.kind,
          status: input.job.status,
          ...input.extra,
        },
      },
    });
  } catch (error) {
    console.error("background job audit failed:", error);
  }
}

export function actorFromUserId(
  userId?: Types.ObjectId | null,
  schoolId?: Types.ObjectId | null
): BackgroundJobActor | null {
  if (!userId) return null;
  return { userId, schoolId: schoolId ?? null };
}
