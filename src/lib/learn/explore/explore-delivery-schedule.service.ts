import "server-only";

import { Types } from "mongoose";

import { connectToDatabase } from "@/db/connectToDatabase";
import {
  buildExploreWorkerContextForClass,
  resolveGradeLevelForClassGroup,
} from "@/lib/learn/explore/explore-class-context";
import {
  createExploreGenerationJob,
  findReadyExploreAdventure,
} from "@/lib/learn/explore/explore-generation.service";
import type { ExploreFeedKickoffResult } from "@/lib/learn/explore/explore-feed-kickoff.service";

export type ScheduleExploreForDeliveredSessionInput = {
  schoolId: Types.ObjectId;
  classGroupId: Types.ObjectId;
  sessionId: Types.ObjectId;
  subjectOfferingId: Types.ObjectId;
};

/**
 * After a teacher completes delivery, queue class-scoped Explore generation for that session.
 */
export async function scheduleExploreGenerationForDeliveredSession(
  input: ScheduleExploreForDeliveredSessionInput
): Promise<ExploreFeedKickoffResult> {
  await connectToDatabase();

  const gradeLevel = await resolveGradeLevelForClassGroup({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
  });

  const existingReady = await findReadyExploreAdventure({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    subjectId: input.subjectOfferingId,
    lessonId: input.sessionId,
    gradeLevel,
  });

  if (existingReady) {
    return { runInBackground: false };
  }

  const worker = await buildExploreWorkerContextForClass({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
  });

  if (!worker) {
    return { runInBackground: false };
  }

  const jobResult = await createExploreGenerationJob({
    schoolId: input.schoolId,
    classGroupId: input.classGroupId,
    subjectOfferingId: input.subjectOfferingId,
    lessonId: input.sessionId,
    gradeLevel,
    mode: "go_deeper",
    requestedByStudentId: worker.studentId,
  });

  if (jobResult.kind === "job_created") {
    return {
      runInBackground: true,
      jobId: jobResult.job._id,
    };
  }

  if (jobResult.kind === "generating" && jobResult.job) {
    return {
      runInBackground: true,
      jobId: jobResult.job._id,
    };
  }

  return { runInBackground: false };
}
