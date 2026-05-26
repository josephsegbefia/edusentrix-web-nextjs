import { Types } from "mongoose";

import { buildExploreGenerationKey } from "@/lib/learn/explore/build-generation-key";
import type {
  ExploreGenerationKeyParams,
  ExploreGenerationJobStatus,
  ExploreGenerationMode,
} from "@/lib/learn/explore/explore-types";
import { ExploreAdventure, type IExploreAdventure } from "@/models/ExploreAdventure";
import {
  ExploreGenerationJob,
  type IExploreGenerationJob,
} from "@/models/ExploreGenerationJob";

export { buildExploreGenerationKey };

/** How long an in-flight generation job holds its lock before it may be retried. */
export const EXPLORE_GENERATION_LOCK_MS = 2 * 60 * 1000;

/** Suggested poll interval for mobile clients while Leo prepares content. */
export const EXPLORE_GENERATION_RETRY_AFTER_SECONDS = 3;

const READY_EXPLORE_ADVENTURE_STATUSES = [
  "ready",
  "teacher_review_recommended",
  "teacher_approved",
] as const;

const IN_PROGRESS_EXPLORE_JOB_STATUSES: ExploreGenerationJobStatus[] = [
  "pending",
  "generating",
  "safety_checking",
  "repairing",
];

const TERMINAL_EXPLORE_JOB_STATUSES: ExploreGenerationJobStatus[] = [
  "ready",
  "failed",
  "blocked",
];

export interface FindReadyExploreAdventureParams extends ExploreGenerationKeyParams {}

export interface CreateExploreGenerationJobParams {
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  /** Subject offering id — stored on the job as `subjectOfferingId`. */
  subjectOfferingId: Types.ObjectId;
  lessonId: Types.ObjectId;
  gradeLevel: string;
  mode?: ExploreGenerationMode;
  requestedByStudentId: Types.ObjectId;
  contentVersion?: string;
}

export type ExploreGenerationJobResult =
  | { kind: "job_created"; job: IExploreGenerationJob; generationKey: string }
  | {
      kind: "generating";
      job: IExploreGenerationJob;
      generationKey: string;
      retryAfterSeconds: number;
      message: string;
    }
  | {
      kind: "ready";
      adventure: IExploreAdventure;
      job?: IExploreGenerationJob | null;
      generationKey: string;
    }
  | {
      kind: "failed";
      job: IExploreGenerationJob;
      generationKey: string;
      errorCode: string;
      message: string;
    };

export interface StaleGenerationJobDetection {
  isStale: boolean;
  canRetry: boolean;
  shouldMarkFailed: boolean;
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

function toGenerationKeyParams(
  params: CreateExploreGenerationJobParams
): ExploreGenerationKeyParams {
  return {
    schoolId: params.schoolId,
    classGroupId: params.classGroupId,
    subjectId: params.subjectOfferingId,
    lessonId: params.lessonId,
    gradeLevel: params.gradeLevel,
    contentVersion: params.contentVersion,
  };
}

function newGenerationLockDates() {
  const now = new Date();
  return {
    lockedAt: now,
    lockExpiresAt: new Date(now.getTime() + EXPLORE_GENERATION_LOCK_MS),
  };
}

/** Returns true when an in-progress job exceeded its lock window. */
export function detectStaleGenerationJob(
  job: Pick<
    IExploreGenerationJob,
    "status" | "lockExpiresAt" | "attempts" | "maxAttempts"
  >,
  now: Date = new Date()
): StaleGenerationJobDetection {
  const isInProgress = IN_PROGRESS_EXPLORE_JOB_STATUSES.includes(job.status);
  const lockExpired =
    job.lockExpiresAt != null && job.lockExpiresAt.getTime() <= now.getTime();
  const isStale = isInProgress && lockExpired;
  const canRetry = job.attempts < job.maxAttempts;

  return {
    isStale,
    canRetry: isStale && canRetry,
    shouldMarkFailed: isStale && !canRetry,
  };
}

export async function findReadyExploreAdventure(
  params: FindReadyExploreAdventureParams
): Promise<IExploreAdventure | null> {
  const generationKey = buildExploreGenerationKey(params);

  const adventure = await ExploreAdventure.findOne({
    generationKey,
    status: { $in: READY_EXPLORE_ADVENTURE_STATUSES },
  }).lean();

  return adventure as IExploreAdventure | null;
}

export async function markJobStatus(
  jobId: Types.ObjectId | string,
  status: ExploreGenerationJobStatus,
  extras?: Partial<
    Pick<
      IExploreGenerationJob,
      "adventureId" | "contentSnapshotId" | "errorCode" | "errorMessage"
    >
  >
): Promise<IExploreGenerationJob | null> {
  const update: Record<string, unknown> = {
    status,
    ...extras,
  };

  if (IN_PROGRESS_EXPLORE_JOB_STATUSES.includes(status)) {
    Object.assign(update, newGenerationLockDates());
  }

  if (TERMINAL_EXPLORE_JOB_STATUSES.includes(status)) {
    update.lockedAt = null;
    update.lockExpiresAt = null;
  }

  const job = await ExploreGenerationJob.findByIdAndUpdate(
    jobId,
    { $set: update },
    { new: true }
  ).lean();

  return job as IExploreGenerationJob | null;
}

async function loadAdventureForReadyJob(
  job: IExploreGenerationJob
): Promise<IExploreAdventure | null> {
  if (!job.adventureId) {
    return findReadyExploreAdventure({
      schoolId: job.schoolId,
      classGroupId: job.classGroupId,
      subjectId: job.subjectOfferingId,
      lessonId: job.lessonId,
      gradeLevel: job.gradeLevel,
    });
  }

  const adventure = await ExploreAdventure.findById(job.adventureId).lean();
  if (!adventure) return null;

  if (
    !READY_EXPLORE_ADVENTURE_STATUSES.includes(
      adventure.status as (typeof READY_EXPLORE_ADVENTURE_STATUSES)[number]
    )
  ) {
    return null;
  }

  return adventure as IExploreAdventure;
}

async function retryStaleExploreGenerationJob(
  job: IExploreGenerationJob
): Promise<IExploreGenerationJob | null> {
  const lock = newGenerationLockDates();

  const updated = await ExploreGenerationJob.findOneAndUpdate(
    {
      _id: job._id,
      status: { $in: [...IN_PROGRESS_EXPLORE_JOB_STATUSES, "failed"] },
      attempts: { $lt: job.maxAttempts },
    },
    {
      $set: {
        status: "pending",
        lockedAt: lock.lockedAt,
        lockExpiresAt: lock.lockExpiresAt,
        errorCode: null,
        errorMessage: null,
      },
      $inc: { attempts: 1 },
    },
    { new: true }
  ).lean();

  return updated as IExploreGenerationJob | null;
}

async function resolveExistingExploreGenerationJob(
  job: IExploreGenerationJob,
  generationKey: string
): Promise<ExploreGenerationJobResult> {
  if (job.status === "ready") {
    const adventure = await loadAdventureForReadyJob(job);
    if (adventure) {
      return { kind: "ready", adventure, job, generationKey };
    }
  }

  const stale = detectStaleGenerationJob(job);

  if (stale.shouldMarkFailed) {
    const failedJob = await markJobStatus(job._id, "failed", {
      errorCode: "GENERATION_TIMEOUT",
      errorMessage: "Explore generation timed out. Please try again later.",
    });

    return {
      kind: "failed",
      job: (failedJob ?? job) as IExploreGenerationJob,
      generationKey,
      errorCode: "GENERATION_TIMEOUT",
      message: "Leo could not finish preparing this mission. Try again soon.",
    };
  }

  if (stale.canRetry) {
    const retriedJob = await retryStaleExploreGenerationJob(job);
    if (retriedJob) {
      return {
        kind: "job_created",
        job: retriedJob,
        generationKey,
      };
    }
  }

  if (job.status === "failed" && job.attempts < job.maxAttempts) {
    const retriedJob = await retryStaleExploreGenerationJob({
      ...job,
      status: "pending",
      lockExpiresAt: new Date(0),
    });
    if (retriedJob) {
      return {
        kind: "job_created",
        job: retriedJob,
        generationKey,
      };
    }
  }

  if (job.status === "failed" || job.status === "blocked") {
    return {
      kind: "failed",
      job,
      generationKey,
      errorCode: job.errorCode ?? "GENERATION_FAILED",
      message:
        job.errorMessage ??
        "Leo could not prepare this Explore mission right now.",
    };
  }

  return {
    kind: "generating",
    job,
    generationKey,
    retryAfterSeconds: EXPLORE_GENERATION_RETRY_AFTER_SECONDS,
    message: "Leo is preparing this Explore mission.",
  };
}

/** Called when a concurrent request lost the race to create the same generation job. */
/** Atomically claim a pending job so only one request runs AI generation. */
export async function tryClaimExploreGenerationJob(
  jobId: Types.ObjectId | string
): Promise<IExploreGenerationJob | null> {
  const lock = newGenerationLockDates();

  const claimed = await ExploreGenerationJob.findOneAndUpdate(
    { _id: jobId, status: "pending" },
    {
      $set: {
        status: "generating",
        lockedAt: lock.lockedAt,
        lockExpiresAt: lock.lockExpiresAt,
        errorCode: null,
        errorMessage: null,
      },
    },
    { new: true }
  ).lean();

  return claimed as IExploreGenerationJob | null;
}

export async function handleDuplicateGenerationJob(
  generationKey: string
): Promise<ExploreGenerationJobResult> {
  const job = await ExploreGenerationJob.findOne({ generationKey }).lean();

  if (!job) {
    throw new Error(
      `Duplicate generation key detected but no ExploreGenerationJob found for ${generationKey}`
    );
  }

  return resolveExistingExploreGenerationJob(
    job as IExploreGenerationJob,
    generationKey
  );
}

/**
 * Creates a class-scoped generation job, or returns the existing in-flight / ready state.
 * Does not call AI — Slice 8+ will process pending jobs.
 */
export async function createExploreGenerationJob(
  params: CreateExploreGenerationJobParams
): Promise<ExploreGenerationJobResult> {
  const keyParams = toGenerationKeyParams(params);
  const generationKey = buildExploreGenerationKey(keyParams);

  const existingReady = await findReadyExploreAdventure(keyParams);
  if (existingReady) {
    const existingJob = await ExploreGenerationJob.findOne({ generationKey }).lean();

    return {
      kind: "ready",
      adventure: existingReady,
      job: (existingJob as IExploreGenerationJob | null) ?? null,
      generationKey,
    };
  }

  const existingJob = await ExploreGenerationJob.findOne({ generationKey }).lean();
  if (existingJob) {
    return resolveExistingExploreGenerationJob(
      existingJob as IExploreGenerationJob,
      generationKey
    );
  }

  const lock = newGenerationLockDates();

  try {
    const created = await ExploreGenerationJob.create({
      generationKey,
      schoolId: params.schoolId,
      classGroupId: params.classGroupId,
      subjectOfferingId: params.subjectOfferingId,
      lessonId: params.lessonId,
      gradeLevel: params.gradeLevel.trim(),
      mode: params.mode ?? "go_deeper",
      status: "pending",
      requestedByStudentId: params.requestedByStudentId,
      attempts: 0,
      maxAttempts: 2,
      lockedAt: lock.lockedAt,
      lockExpiresAt: lock.lockExpiresAt,
    });

    return {
      kind: "job_created",
      job: created.toObject() as IExploreGenerationJob,
      generationKey,
    };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    return handleDuplicateGenerationJob(generationKey);
  }
}
