import type { FilterQuery } from "mongoose";
import { BackgroundJob, type IBackgroundJob } from "@/models/BackgroundJob";
import type { BackgroundJobKind } from "./job-kinds";
import { isBackgroundJobKind, userVisibleBackgroundJobKinds } from "./job-kinds";
import {
  ACTIVE_BACKGROUND_JOB_STATUSES,
  isBackgroundJobStatus,
  type BackgroundJobStatus,
} from "./job-status";
import type { BackgroundJobActor } from "./authorization";

export type BackgroundJobListFilter = "active" | "completed" | "failed";
export type BackgroundJobListScope = "mine" | "school";

export function parseBackgroundJobListFilter(value: string | null): BackgroundJobListFilter | null {
  if (!value) return null;
  if (value === "active" || value === "completed" || value === "failed") return value;
  return null;
}

export function parseBackgroundJobListKind(value: string | null): BackgroundJobKind | null {
  if (!value) return null;
  return isBackgroundJobKind(value) ? value : null;
}

export function parseBackgroundJobListScope(value: string | null): BackgroundJobListScope {
  return value === "school" ? "school" : "mine";
}

function applyListFilter(
  query: FilterQuery<IBackgroundJob>,
  filter?: BackgroundJobListFilter | null
) {
  if (filter === "active") {
    query.status = { $in: [...ACTIVE_BACKGROUND_JOB_STATUSES] };
  } else if (filter === "completed") {
    query.status = "succeeded" satisfies BackgroundJobStatus;
  } else if (filter === "failed") {
    query.status = "failed";
  }
}

export async function listCurrentUserBackgroundJobs(input: {
  actor: BackgroundJobActor;
  filter?: BackgroundJobListFilter | null;
  kind?: BackgroundJobKind | null;
  scope?: BackgroundJobListScope;
  limit: number;
  offset: number;
}): Promise<{ jobs: IBackgroundJob[]; total: number }> {
  if (!input.actor.schoolId) {
    return { jobs: [], total: 0 };
  }

  const visibleKinds = userVisibleBackgroundJobKinds();
  const query: FilterQuery<IBackgroundJob> = {
    schoolId: input.actor.schoolId,
    kind: input.kind ? input.kind : { $in: visibleKinds },
  };

  if (input.kind && !visibleKinds.includes(input.kind)) {
    return { jobs: [], total: 0 };
  }

  const schoolWide = input.scope === "school" && Boolean(input.actor.isSchoolAdmin);
  if (!schoolWide) {
    query.$or = [
      { initiatedByUserId: input.actor.userId },
      { targetUserId: input.actor.userId },
      { notificationTargetUserId: input.actor.userId },
    ];
  }

  applyListFilter(query, input.filter);

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

export async function listOperatorBackgroundJobs(input: {
  status?: BackgroundJobStatus | null;
  kind?: BackgroundJobKind | null;
  stale?: boolean;
  staleBefore?: Date | null;
  limit: number;
  offset: number;
}): Promise<{ jobs: IBackgroundJob[]; total: number }> {
  const query: FilterQuery<IBackgroundJob> = {};
  if (input.kind) query.kind = input.kind;
  if (input.status) query.status = input.status;
  if (input.stale && input.staleBefore) {
    query.status = input.status ?? { $in: ["running", "waiting"] };
    query.$or = [{ lastHeartbeatAt: { $lt: input.staleBefore } }, { lastHeartbeatAt: null }];
  }

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

export function parseOperatorJobStatus(value: string | null): BackgroundJobStatus | null {
  if (!value) return null;
  return isBackgroundJobStatus(value) ? value : null;
}
