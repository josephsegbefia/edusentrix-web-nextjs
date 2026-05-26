import "server-only";

import { Types } from "mongoose";

import { connectToDatabase } from "@/db/connectToDatabase";
import {
  defaultSinceDays,
  findLatestCoveredLessonSession,
} from "@/lib/learn/covered-lesson-sessions";
import { resolveExploreGenerationContext } from "@/lib/learn/explore/explore-context-resolver";
import {
  createExploreGenerationJob,
  detectStaleGenerationJob,
  findReadyExploreAdventure,
} from "@/lib/learn/explore/explore-generation.service";
import { ExploreAdventure } from "@/models/ExploreAdventure";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { getStudentLearnAccess } from "@/lib/learn/access";

export type ExploreFeedKickoffResult = {
  runInBackground: boolean;
  jobId?: Types.ObjectId;
};

/**
 * When the class has covered lessons but no ready Explore adventures yet, create (or revive)
 * a generation job for the latest covered session. Spec §11.1 — lazy generation on feed load.
 */
export async function kickoffLazyExploreFeedGeneration(
  context: LearnMobileStudentContext
): Promise<ExploreFeedKickoffResult> {
  if (!context.classGroupId) {
    return { runInBackground: false };
  }

  await connectToDatabase();

  const access = await getStudentLearnAccess({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  });

  if (!access.hasAccess) {
    return { runInBackground: false };
  }

  const readyCount = await ExploreAdventure.countDocuments({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    status: { $in: ["ready", "teacher_review_recommended", "teacher_approved"] },
  });

  if (readyCount > 0) {
    return { runInBackground: false };
  }

  const latestCovered = await findLatestCoveredLessonSession({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    since: defaultSinceDays(45),
    select: "_id title subjectOfferingId",
  });

  if (!latestCovered) {
    return { runInBackground: false };
  }

  const resolved = await resolveExploreGenerationContext({
    auth: context,
    lessonId: `session-${latestCovered._id}`,
    subjectId: String(latestCovered.subjectOfferingId),
  });

  if (!resolved.ok) {
    return { runInBackground: false };
  }

  const ctx = resolved.context;

  const existingReady = await findReadyExploreAdventure({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    subjectId: new Types.ObjectId(ctx.subjectOfferingId),
    lessonId: new Types.ObjectId(ctx.lessonId),
    gradeLevel: ctx.gradeLevel,
  });

  if (existingReady) {
    return { runInBackground: false };
  }

  const jobResult = await createExploreGenerationJob({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    subjectOfferingId: new Types.ObjectId(ctx.subjectOfferingId),
    lessonId: new Types.ObjectId(ctx.lessonId),
    gradeLevel: ctx.gradeLevel,
    mode: "go_deeper",
    requestedByStudentId: context.studentId,
  });

  if (jobResult.kind === "ready") {
    return { runInBackground: false };
  }

  if (jobResult.kind === "failed") {
    return { runInBackground: false };
  }

  if (jobResult.kind === "job_created") {
    return {
      runInBackground: true,
      jobId: jobResult.job._id,
    };
  }

  if (jobResult.kind === "generating") {
    const stale = detectStaleGenerationJob(jobResult.job);
    if (stale.canRetry) {
      return {
        runInBackground: true,
        jobId: jobResult.job._id,
      };
    }
  }

  return { runInBackground: false };
}
