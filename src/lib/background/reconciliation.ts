import "server-only";

import { BackgroundJob, type IBackgroundJob } from "@/models/BackgroundJob";
import { BulkImportJob } from "@/models/BulkImportJob";
import { TeacherImportJob } from "@/models/TeacherImportJob";
import { StudentImportJob } from "@/models/StudentImportJob";
import { ExploreGenerationJob } from "@/models/ExploreGenerationJob";
import { LessonAiGenerationRequest } from "@/models/LessonAiGenerationRequest";
import { LessonIllustrationRequest } from "@/models/LessonIllustrationRequest";
import { LibraryImportJob } from "@/models/LibraryImportJob";
import { SchemeImportJob } from "@/models/SchemeImportJob";
import { writeBackgroundJobAudit } from "./audit";
import { MAX_DISPATCH_RECOVERY_ATTEMPTS, redispatchBackgroundJob } from "./enqueue-job";
import { enqueueLibraryImportBackgroundJob } from "@/lib/library/enqueue-library-import";
import { enqueueExploreGenerationWork } from "@/lib/learn/explore/enqueue-explore-generation";
import {
  recoverTeacherImportAnalysisDispatch,
  recoverTeacherImportCommitDispatch,
} from "@/lib/teachers/teacher-import-workflow";
import {
  recoverStudentImportAnalysisDispatch,
  recoverStudentImportCommitDispatch,
} from "@/lib/students/student-import-recovery";
import { markJobFailed, markJobSucceeded } from "./state-machine";
import { staleHeartbeatMsForKind } from "./stale-jobs";
import { resolveBulkImportRouting } from "@/lib/imports/bulk-import-routing";
import {
  LEGACY_BULK_IMPORT_SUPERSEDED_CODE,
  LEGACY_BULK_IMPORT_SUPERSEDED_MESSAGE,
  quarantineLegacyBulkImport,
} from "@/lib/imports/legacy-bulk-import-quarantine";

export const RECONCILIATION_SCAN_LIMIT = 50;
export const DISPATCH_RECOVERY_BACKOFF_MS = 2 * 60 * 1000;

export type ReconciliationSummary = {
  scanned: number;
  redispatched: number;
  markedSucceeded: number;
  orphansEnqueued: number;
  flagged: number;
  exhausted: number;
};

function isHeartbeatStale(job: {
  kind: string;
  lastHeartbeatAt?: Date | null;
  startedAt?: Date | null;
}): boolean {
  const heartbeat = job.lastHeartbeatAt ?? job.startedAt;
  if (!heartbeat) return true;
  return Date.now() - new Date(heartbeat).getTime() > staleHeartbeatMsForKind(job.kind);
}

async function domainAlreadySucceeded(job: IBackgroundJob): Promise<boolean> {
  if (!job.subjectId || !job.schoolId) return false;
  const id = job.subjectId;
  const schoolId = job.schoolId;
  if (job.kind === "LIBRARY_IMPORT") {
    const row = await LibraryImportJob.findOne({ _id: id, schoolId }).select("status").lean();
    return row?.status === "completed" || row?.status === "completed_with_errors";
  }
  if (job.kind === "BULK_IMPORT") {
    const routing = resolveBulkImportRouting(job);
    if (!routing.ok) return false;
    if (routing.routing.kind === "teacher_staged") {
      const row = await TeacherImportJob.findOne({ _id: id, schoolId }).select("status").lean();
      return routing.routing.phase === "analysis"
        ? ["review_ready", "committing", "completed", "completed_with_errors"].includes(row?.status || "")
        : ["completed", "completed_with_errors"].includes(row?.status || "");
    }
    if (routing.routing.kind === "student_staged") {
      const row = await StudentImportJob.findOne({ _id: id, schoolId }).select("status").lean();
      return routing.routing.phase === "analysis"
        ? ["review_ready", "committing", "completed", "completed_with_errors"].includes(row?.status || "")
        : ["completed", "completed_with_errors"].includes(row?.status || "");
    }
    return false;
  }
  if (job.kind === "SCHEME_IMPORT") {
    const row = await SchemeImportJob.findOne({ _id: id, schoolId }).select("status").lean();
    return row?.status === "parsed" || row?.status === "confirmed";
  }
  if (job.kind === "AI_LESSON_GENERATION") {
    const row = await LessonAiGenerationRequest.findOne({ _id: id, schoolId }).select("status").lean();
    return row?.status === "succeeded";
  }
  if (job.kind === "AI_LESSON_ILLUSTRATION") {
    const row = await LessonIllustrationRequest.findOne({ _id: id, schoolId }).select("status").lean();
    return row?.status === "succeeded";
  }
  if (job.kind === "EXPLORE_GENERATION") {
    const row = await ExploreGenerationJob.findOne({ _id: id, schoolId }).select("status").lean();
    return row?.status === "ready";
  }
  return false;
}

export async function reconcileStaleAndDispatchFailedJobs(): Promise<ReconciliationSummary> {
  const summary: ReconciliationSummary = {
    scanned: 0,
    redispatched: 0,
    markedSucceeded: 0,
    orphansEnqueued: 0,
    flagged: 0,
    exhausted: 0,
  };

  const dispatchFailed = await BackgroundJob.find({ status: "dispatch_failed" })
    .sort({ updatedAt: 1 })
    .limit(RECONCILIATION_SCAN_LIMIT);
  summary.scanned += dispatchFailed.length;

  for (const job of dispatchFailed) {
    if ((job.recoveryAttempts ?? 0) >= MAX_DISPATCH_RECOVERY_ATTEMPTS) {
      summary.exhausted += 1;
      continue;
    }
    if (await quarantineOrRejectUnsafeBulkImportJob(job)) {
      summary.flagged += 1;
      continue;
    }
    if (
      job.lastRecoveryAt &&
      Date.now() - new Date(job.lastRecoveryAt).getTime() < DISPATCH_RECOVERY_BACKOFF_MS
    ) {
      continue;
    }
    const result = await redispatchBackgroundJob(job._id);
    if (result.dispatched) {
      summary.redispatched += 1;
      await writeBackgroundJobAudit({
        actionCode: "background.job.recovery_action",
        job: result.job,
        extra: { action: "redispatch" },
      });
    } else {
      summary.flagged += 1;
    }
  }

  const running = await BackgroundJob.find({
    status: { $in: ["running", "waiting", "queued"] },
  })
    .sort({ updatedAt: 1 })
    .limit(RECONCILIATION_SCAN_LIMIT);

  for (const job of running) {
    summary.scanned += 1;
    if (await quarantineOrRejectUnsafeBulkImportJob(job)) {
      summary.flagged += 1;
      continue;
    }
    if (job.status === "queued" && job.inngestEventId) continue;
    if (job.status !== "queued" && !isHeartbeatStale(job)) continue;
    if (await domainAlreadySucceeded(job)) {
      await markJobSucceeded(job._id, { recovered: true });
      summary.markedSucceeded += 1;
      await writeBackgroundJobAudit({
        actionCode: "background.job.recovery_action",
        job,
        extra: { action: "mark_succeeded" },
      });
      continue;
    }
    if (job.status === "queued" && !job.inngestEventId) {
      const result = await redispatchBackgroundJob(job._id);
      if (result.dispatched) summary.redispatched += 1;
      else summary.flagged += 1;
      continue;
    }
    summary.flagged += 1;
  }

  summary.orphansEnqueued += await recoverOrphanDomainJobs();
  return summary;
}

export async function countOrphanDomainJobs(): Promise<number> {
  const [library, scheme, teacherAnalysis, teacherCommit, studentAnalysis, studentCommit, lesson, illustration, explore] = await Promise.all([
    LibraryImportJob.countDocuments({
      status: { $in: ["pending", "processing"] },
      $or: [{ backgroundJobId: null }, { backgroundJobId: { $exists: false } }],
    }),
    SchemeImportJob.countDocuments({
      status: { $in: ["queued", "parsing"] },
      $or: [{ backgroundJobId: null }, { backgroundJobId: { $exists: false } }],
    }),
    TeacherImportJob.countDocuments({ status: { $in: ["uploaded", "analyzing"] }, $or: [{ analysisBackgroundJobId: null }, { analysisBackgroundJobId: { $exists: false } }] }),
    TeacherImportJob.countDocuments({ status: "committing", $or: [{ commitBackgroundJobId: null }, { commitBackgroundJobId: { $exists: false } }] }),
    StudentImportJob.countDocuments({ status: { $in: ["uploaded", "analyzing"] }, $or: [{ analysisBackgroundJobId: null }, { analysisBackgroundJobId: { $exists: false } }] }),
    StudentImportJob.countDocuments({ status: "committing", $or: [{ commitBackgroundJobId: null }, { commitBackgroundJobId: { $exists: false } }] }),
    LessonAiGenerationRequest.countDocuments({
      status: { $in: ["queued", "running"] },
      $or: [{ backgroundJobId: null }, { backgroundJobId: { $exists: false } }],
    }),
    LessonIllustrationRequest.countDocuments({
      status: { $in: ["queued", "running"] },
      $or: [{ backgroundJobId: null }, { backgroundJobId: { $exists: false } }],
    }),
    ExploreGenerationJob.countDocuments({
      status: { $in: ["pending", "generating"] },
      $or: [{ backgroundJobId: null }, { backgroundJobId: { $exists: false } }],
    }),
  ]);
  return library + scheme + teacherAnalysis + teacherCommit + studentAnalysis + studentCommit + lesson + illustration + explore;
}

async function recoverOrphanDomainJobs(): Promise<number> {
  let enqueued = 0;
  const library = await LibraryImportJob.find({
    status: { $in: ["pending", "processing"] },
    $or: [{ backgroundJobId: null }, { backgroundJobId: { $exists: false } }],
  }).limit(10);
  for (const row of library) {
    await enqueueLibraryImportBackgroundJob({
      schoolId: row.schoolId,
      libraryImportJobId: row._id,
      initiatedByUserId: row.createdBy,
    });
    enqueued += 1;
  }

  const bulk = await BulkImportJob.find({
    status: { $in: ["pending", "processing"] },
    $or: [{ backgroundJobId: null }, { backgroundJobId: { $exists: false } }],
  }).limit(10);
  for (const row of bulk) {
    await quarantineLegacyBulkImport({ bulkImportJobId: row._id, schoolId: row.schoolId });
  }

  const teacherAnalysis = await TeacherImportJob.find({
    status: { $in: ["uploaded", "analyzing"] },
    $or: [{ analysisBackgroundJobId: null }, { analysisBackgroundJobId: { $exists: false } }],
  }).limit(10);
  for (const row of teacherAnalysis) {
    if (await recoverTeacherImportAnalysisDispatch({ schoolId: row.schoolId, teacherImportJobId: row._id })) enqueued += 1;
  }

  const teacherCommit = await TeacherImportJob.find({
    status: "committing",
    approvedAt: { $ne: null },
    $or: [{ commitBackgroundJobId: null }, { commitBackgroundJobId: { $exists: false } }],
  }).limit(10);
  for (const row of teacherCommit) {
    if (await recoverTeacherImportCommitDispatch({ schoolId: row.schoolId, teacherImportJobId: row._id })) enqueued += 1;
  }

  const studentAnalysis = await StudentImportJob.find({
    status: { $in: ["uploaded", "analyzing"] },
    $or: [{ analysisBackgroundJobId: null }, { analysisBackgroundJobId: { $exists: false } }],
  }).limit(10);
  for (const row of studentAnalysis) {
    if (await recoverStudentImportAnalysisDispatch({ schoolId: row.schoolId, studentImportJobId: row._id })) enqueued += 1;
  }

  const studentCommit = await StudentImportJob.find({
    status: "committing",
    approvedAt: { $ne: null },
    $or: [{ commitBackgroundJobId: null }, { commitBackgroundJobId: { $exists: false } }],
  }).limit(10);
  for (const row of studentCommit) {
    if (await recoverStudentImportCommitDispatch({ schoolId: row.schoolId, studentImportJobId: row._id })) enqueued += 1;
  }

  const explore = await ExploreGenerationJob.find({
    status: { $in: ["pending", "generating"] },
    $or: [{ backgroundJobId: null }, { backgroundJobId: { $exists: false } }],
  }).limit(10);
  for (const row of explore) {
    await enqueueExploreGenerationWork({
      exploreJob: row,
      trigger: "system",
    });
    enqueued += 1;
  }

  return enqueued;
}

/** Returns true when normal recovery must stop rather than mutate through an unsafe route. */
async function quarantineOrRejectUnsafeBulkImportJob(job: IBackgroundJob): Promise<boolean> {
  if (job.kind !== "BULK_IMPORT") return false;
  const routing = resolveBulkImportRouting(job);
  if (!routing.ok) {
    await markJobFailed(job._id, {
      code: routing.code,
      message: routing.message,
      category: "PREREQUISITE_FAILED",
    });
    return true;
  }
  if (routing.routing.kind !== "legacy") return false;
  if (job.schoolId) {
    await quarantineLegacyBulkImport({
      bulkImportJobId: routing.routing.importJobId,
      schoolId: job.schoolId,
    });
  }
  await markJobFailed(job._id, {
    code: LEGACY_BULK_IMPORT_SUPERSEDED_CODE,
    message: LEGACY_BULK_IMPORT_SUPERSEDED_MESSAGE,
    category: "PERMANENT",
  });
  return true;
}
