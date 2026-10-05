import type { FilterQuery } from "mongoose";
import { BackgroundJob, type IBackgroundJob } from "@/models/BackgroundJob";
import type { BackgroundJobKind } from "./job-kinds";
import { isBackgroundJobKind } from "./job-kinds";
import {
  ACTIVE_BACKGROUND_JOB_STATUSES,
  type BackgroundJobStatus,
} from "./job-status";
import type { BackgroundJobActor } from "./authorization";

export type BackgroundJobListFilter = "active" | "completed" | "failed";

export function parseBackgroundJobListFilter(value: string | null): BackgroundJobListFilter | null {
  if (!value) return null;
  if (value === "active" || value === "completed" || value === "failed") return value;
  return null;
}

export function parseBackgroundJobListKind(value: string | null): BackgroundJobKind | null {
  if (!value) return null;
  return isBackgroundJobKind(value) ? value : null;
}

export async function listCurrentUserBackgroundJobs(input: {
  actor: BackgroundJobActor;
  filter?: BackgroundJobListFilter | null;
  kind?: BackgroundJobKind | null;
  limit: number;
  offset: number;
}): Promise<{ jobs: IBackgroundJob[]; total: number }> {
  if (!input.actor.schoolId) {
    return { jobs: [], total: 0 };
  }

  const query: FilterQuery<IBackgroundJob> = {
    schoolId: input.actor.schoolId,
    $or: [
      { initiatedByUserId: input.actor.userId },
      { targetUserId: input.actor.userId },
      { notificationTargetUserId: input.actor.userId },
    ],
  };

  if (input.filter === "active") {
    query.status = { $in: [...ACTIVE_BACKGROUND_JOB_STATUSES] };
  } else if (input.filter === "completed") {
    query.status = "succeeded" satisfies BackgroundJobStatus;
  } else if (input.filter === "failed") {
    query.status = "failed";
  }
  if (input.kind) query.kind = input.kind;

  const [total, jobs] = await Promise.all([
    BackgroundJob.countDocuments(query),
    BackgroundJob.find(query)
      .sort({ createdAt: -1 })
      .skip(input.offset)
      .limit(input.limit)
      .lean<IBackgroundJob[]>(),
  ]);

  return { jobs, total };
}
