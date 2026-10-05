import "server-only";

import { Types } from "mongoose";
import type { TrackedJobContext } from "@/lib/background/worker-wrapper";
import {
  classifyAiProviderError,
  lessonGenerationPrerequisiteError,
} from "@/lib/background/ai-errors";
import { buildExploreWorkerContextForClass } from "@/lib/learn/explore/explore-class-context";
import { resolveExploreGenerationContext } from "@/lib/learn/explore/explore-context-resolver";
import { runExploreGenerationPipeline } from "@/lib/learn/explore/explore-lazy-generate.service";
import { ExploreGenerationJob } from "@/models/ExploreGenerationJob";
import { LearnStudentAccount } from "@/models/LearnStudentAccount";
import { Student } from "@/models/Student";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";

async function rebuildExploreAuth(
  job: {
    schoolId: Types.ObjectId;
    classGroupId: Types.ObjectId;
    requestedByStudentId: Types.ObjectId;
  }
): Promise<LearnMobileStudentContext> {
  const fromClass = await buildExploreWorkerContextForClass({
    schoolId: job.schoolId,
    classGroupId: job.classGroupId,
  });
  if (fromClass) return fromClass;

  const student = await Student.findOne({
    _id: job.requestedByStudentId,
    schoolId: job.schoolId,
  })
    .select("_id schoolId gradeId classGroupId")
    .lean<{
      _id: Types.ObjectId;
      schoolId: Types.ObjectId;
      gradeId?: Types.ObjectId | null;
      classGroupId?: Types.ObjectId | null;
    } | null>();
  if (!student) {
    throw lessonGenerationPrerequisiteError("Explore generation student context is missing.");
  }
  const account = await LearnStudentAccount.findOne({
    schoolId: job.schoolId,
    studentId: student._id,
  })
    .select("_id mustChangePassword")
    .lean<{ _id: Types.ObjectId; mustChangePassword?: boolean } | null>();

  return {
    accountId: account?._id ?? student._id,
    sessionId: account?._id ?? student._id,
    studentId: student._id,
    schoolId: student.schoolId,
    gradeId: student.gradeId ?? null,
    classGroupId: student.classGroupId ?? job.classGroupId,
    mustChangePassword: account?.mustChangePassword ?? false,
  };
}

export async function executeExploreGeneration(
  tracked: TrackedJobContext
): Promise<Record<string, unknown>> {
  const exploreGenerationJobId =
    typeof tracked.job.input?.exploreGenerationJobId === "string"
      ? tracked.job.input.exploreGenerationJobId
      : null;
  if (!exploreGenerationJobId || !Types.ObjectId.isValid(exploreGenerationJobId)) {
    throw lessonGenerationPrerequisiteError("exploreGenerationJobId is required");
  }

  const job = await ExploreGenerationJob.findById(exploreGenerationJobId);
  if (!job) {
    throw lessonGenerationPrerequisiteError("Explore generation job not found");
  }
  if (String(job.schoolId) !== String(tracked.job.schoolId)) {
    throw lessonGenerationPrerequisiteError("Explore generation tenant mismatch");
  }

  await tracked.updateProgress({
    progressPercent: 5,
    progressStage: "preparing_context",
    progressMessage: "Preparing Explore context",
  });
  await tracked.throwIfCancellationRequested();

  const auth = await rebuildExploreAuth(job);
  const resolved = await resolveExploreGenerationContext({
    auth,
    lessonId: `session-${job.lessonId}`,
    subjectId: String(job.subjectOfferingId),
  });
  if (!resolved.ok) {
    throw lessonGenerationPrerequisiteError(resolved.message);
  }

  await tracked.updateProgress({
    progressPercent: 20,
    progressStage: "generating",
    progressMessage: "Generating Explore mission",
  });
  await tracked.throwIfCancellationRequested();

  const pipeline = await runExploreGenerationPipeline({
    auth,
    jobId: job._id,
    mode: job.mode ?? "go_deeper",
    exploreContext: resolved.context,
    existingAdventureId: job.adventureId ?? undefined,
    onProgress: async (stage) => {
      if (stage === "safety_checking") {
        await tracked.updateProgress({
          progressPercent: 70,
          progressStage: "validating",
          progressMessage: "Checking Explore safety",
        });
      }
      if (stage === "repairing") {
        await tracked.updateProgress({
          progressPercent: 75,
          progressStage: "validating",
          progressMessage: "Repairing Explore draft",
        });
      }
      if (stage === "saving") {
        await tracked.updateProgress({
          progressPercent: 85,
          progressStage: "saving_draft",
          progressMessage: "Saving Explore draft",
        });
      }
    },
  });

  if (!pipeline.ok) {
    if (pipeline.code === "CONTENT_BLOCKED") {
      return {
        exploreGenerationJobId: String(job._id),
        generationKey: job.generationKey,
        blocked: true,
        notification: {
          title: "Explore generation needs review",
          body: pipeline.message,
        },
      };
    }
    throw classifyAiProviderError(new Error(pipeline.message));
  }

  await tracked.updateProgress({
    progressPercent: 100,
    progressStage: "complete",
    progressMessage: "Explore content is ready",
  });

  const sessionId =
    typeof tracked.job.input?.sessionId === "string" ? tracked.job.input.sessionId : String(job.lessonId);
  const actionUrl = `/teacher/lessons/sessions/${sessionId}`;

  return {
    exploreGenerationJobId: String(job._id),
    generationKey: pipeline.generationKey,
    adventureId: pipeline.adventureId,
    snapshotId: pipeline.snapshotId ?? null,
    actionUrl,
    notification: {
      title: "Explore generation complete",
      body: "Explore content generation is complete.",
      actionUrl,
    },
  };
}
