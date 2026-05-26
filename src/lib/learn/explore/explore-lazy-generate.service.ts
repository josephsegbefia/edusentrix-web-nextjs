import "server-only";

import { Types } from "mongoose";

import { connectToDatabase } from "@/db/connectToDatabase";
import { generateExploreAiContent, repairExploreAiContent } from "@/lib/learn/explore/explore-ai.service";
import {
  ensureStudentExploreRecord,
  loadExploreSnapshotForAdventure,
  loadFallbackExploreAdventures,
  saveExploreAdventureBundle,
  serializeExploreAdventureForStudent,
  type MobileExploreAdventurePayload,
} from "@/lib/learn/explore/explore-content.service";
import { resolveExploreGenerationContext } from "@/lib/learn/explore/explore-context-resolver";
import {
  buildExploreLessonBrief,
} from "@/lib/learn/explore/explore-context-resolver";
import { loadCoveredLessonSessionById } from "@/lib/learn/covered-lesson-sessions";
import { buildExploreGenerationKey } from "@/lib/learn/explore/build-generation-key";
import { parseExploreAdventureId } from "@/lib/learn/explore/build-generation-key";
import { ExploreAdventure, type IExploreAdventure } from "@/models/ExploreAdventure";
import {
  createExploreGenerationJob,
  EXPLORE_GENERATION_RETRY_AFTER_SECONDS,
  findReadyExploreAdventure,
  markJobStatus,
  tryClaimExploreGenerationJob,
} from "@/lib/learn/explore/explore-generation.service";
import { buildGuidedAdventureContentV2 } from "@/lib/learn/explore/explore-schemas";
import type {
  ExploreGenerationMode,
  ResolvedExploreGenerationContext,
} from "@/lib/learn/explore/explore-types";
import {
  EXPLORE_MAX_SAFETY_REPAIR_ATTEMPTS,
  reviewExploreContentSafety,
  toExploreSafetyResult,
} from "@/lib/learn/explore/explore-safety.service";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { getStudentLearnAccess } from "@/lib/learn/access";
import { buildExploreAdventureId } from "@/lib/learn/explore/build-generation-key";
import {
  ExploreGenerationJob,
  type IExploreGenerationJob,
} from "@/models/ExploreGenerationJob";
import { StudentExploreRecord } from "@/models/StudentExploreRecord";

export type ExploreGenerateResponse =
  | {
      state: "ready";
      adventureId: string;
      adventure: MobileExploreAdventurePayload;
      generationKey: string;
    }
  | {
      state: "generating" | "safety_checking" | "repairing";
      generationKey: string;
      message: string;
      retryAfterSeconds: number;
      fallbackAdventures?: MobileExploreAdventurePayload[];
    }
  | {
      state: "failed" | "blocked";
      generationKey: string;
      message: string;
      fallbackAdventures?: MobileExploreAdventurePayload[];
    };

async function assertLazyExploreAccess(context: LearnMobileStudentContext) {
  const access = await getStudentLearnAccess({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  });

  if (!access.hasAccess) {
    return {
      ok: false as const,
      code: access.schoolEligible ? "LEARN_ACCESS_REQUIRED" : "SCHOOL_NOT_ELIGIBLE",
      message: access.blockedReason || "Learn access required.",
      friendlyMessage: access.schoolEligible
        ? "EduSentrix Learn is not active on your account yet."
        : "EduSentrix Learn is available for Premium schools.",
      status: 403,
    };
  }

  if (!context.classGroupId) {
    return {
      ok: false as const,
      code: "NO_STUDENT_PROFILE",
      message: "Class group not found.",
      friendlyMessage: "We could not find your class yet.",
      status: 404,
    };
  }

  return { ok: true as const };
}

async function hydrateReadyAdventure(input: {
  auth: LearnMobileStudentContext;
  adventureId: Types.ObjectId;
  relatedLessonTitles?: string[];
}) {
  const loaded = await loadExploreSnapshotForAdventure(input.adventureId);
  if (!loaded) return null;

  const record = await StudentExploreRecord.findOne({
    studentId: input.auth.studentId,
    adventureId: input.adventureId,
  }).lean();

  await ensureStudentExploreRecord({
    auth: input.auth,
    adventureId: input.adventureId,
    contentSnapshotId: loaded.snapshot._id,
  });

  return serializeExploreAdventureForStudent({
    adventure: loaded.adventure,
    snapshot: loaded.snapshot,
    studentId: String(input.auth.studentId),
    record: record as typeof record,
    sourceContext: loaded.snapshot.sourceContext,
    relatedLessonTitles: input.relatedLessonTitles,
  });
}

async function runGenerationPipeline(input: {
  auth: LearnMobileStudentContext;
  jobId: Types.ObjectId;
  mode: ExploreGenerationMode;
  exploreContext: ResolvedExploreGenerationContext;
  existingAdventureId?: Types.ObjectId;
}) {
  const ctx = input.exploreContext;

  await markJobStatus(input.jobId, "generating");

  const aiResult = await generateExploreAiContent({ context: ctx, mode: input.mode });
  if (!aiResult.ok) {
    await markJobStatus(input.jobId, "failed", {
      errorCode: "AI_GENERATION_FAILED",
      errorMessage: aiResult.error,
    });
    return {
      ok: false as const,
      code: "AI_GENERATION_FAILED",
      message: "Leo could not prepare this Explore mission right now.",
    };
  }

  let contentCandidate = aiResult.output;
  let repairAttempts = 0;

  const bound = buildGuidedAdventureContentV2({
    ai: contentCandidate,
    sourceLessonId: `session-${ctx.lessonId}`,
  });

  if (!bound.ok) {
    await markJobStatus(input.jobId, "failed", {
      errorCode: "SCHEMA_VALIDATION_FAILED",
      errorMessage: bound.message,
    });
    return {
      ok: false as const,
      code: "SCHEMA_VALIDATION_FAILED",
      message: "Leo's adventure did not pass our safety checks. Try again later.",
    };
  }

  let content = bound.data;

  while (repairAttempts <= EXPLORE_MAX_SAFETY_REPAIR_ATTEMPTS) {
    await markJobStatus(input.jobId, repairAttempts > 0 ? "repairing" : "safety_checking");

    const review = reviewExploreContentSafety({
      content,
      lessonBrief: ctx.lessonBrief,
      gradeName: ctx.gradeName,
    });

    if (review.outcome === "passed" || review.outcome === "teacher_review_required") {
      const safetyResult = toExploreSafetyResult(review, repairAttempts);

      const saved = await saveExploreAdventureBundle({
        generationKey: ctx.generationKey,
        schoolId: new Types.ObjectId(ctx.schoolId),
        classGroupId: new Types.ObjectId(ctx.classGroupId),
        subjectOfferingId: new Types.ObjectId(ctx.subjectOfferingId),
        lessonId: new Types.ObjectId(ctx.lessonId),
        gradeLevel: ctx.gradeLevel,
        content,
        sourceContext: {
          schoolId: ctx.sourceContext.schoolId,
          classGroupId: ctx.sourceContext.classGroupId,
          subjectId: ctx.sourceContext.subjectId,
          lessonId: ctx.sourceContext.lessonId,
          lessonTitle: ctx.sourceContext.lessonTitle,
          gradeLevel: ctx.sourceContext.gradeLevel,
          curriculum: ctx.sourceContext.curriculum,
        },
        aiMetadata: {
          provider: aiResult.provider,
          model: aiResult.model,
          promptVersion: aiResult.promptVersion,
          generatedBy: "backend_ai",
          generationPromptSummary: `Lazy Explore for ${ctx.lessonTitle}`,
          temperature: aiResult.temperature,
        },
        safetyResult,
        existingAdventureId: input.existingAdventureId,
      });

      await markJobStatus(input.jobId, "ready", {
        adventureId: saved.adventure._id,
        contentSnapshotId: saved.snapshot._id,
      });

      await ensureStudentExploreRecord({
        auth: input.auth,
        adventureId: saved.adventure._id,
        contentSnapshotId: saved.snapshot._id,
      });

      const adventure = serializeExploreAdventureForStudent({
        adventure: saved.adventure,
        snapshot: saved.snapshot,
        studentId: String(input.auth.studentId),
        record: null,
        sourceContext: saved.snapshot.sourceContext,
        relatedLessonTitles: ctx.relatedLessonTitles,
      });

      return {
        ok: true as const,
        generationKey: ctx.generationKey,
        adventureId: buildExploreAdventureId(saved.adventure._id),
        adventure,
      };
    }

    if (review.outcome === "blocked") {
      await markJobStatus(input.jobId, "blocked", {
        errorCode: "CONTENT_BLOCKED",
        errorMessage: review.finalNotes.join(" "),
      });
      return {
        ok: false as const,
        code: "CONTENT_BLOCKED",
        state: "blocked" as const,
        generationKey: ctx.generationKey,
        message: "This Explore mission could not be shown safely.",
      };
    }

    if (repairAttempts >= EXPLORE_MAX_SAFETY_REPAIR_ATTEMPTS) {
      await markJobStatus(input.jobId, "failed", {
        errorCode: "SAFETY_REPAIR_EXHAUSTED",
        errorMessage: review.finalNotes.join(" "),
      });
      return {
        ok: false as const,
        code: "SAFETY_REPAIR_EXHAUSTED",
        state: "failed" as const,
        generationKey: ctx.generationKey,
        message: "Leo could not finish preparing this mission safely.",
      };
    }

    repairAttempts += 1;
    const repair = await repairExploreAiContent({
      content: contentCandidate,
      failedChecks: review.failedCheckNames,
      context: ctx,
    });

    if (!repair.ok) {
      await markJobStatus(input.jobId, "failed", {
        errorCode: "SAFETY_REPAIR_FAILED",
        errorMessage: repair.error,
      });
      return {
        ok: false as const,
        code: "SAFETY_REPAIR_FAILED",
        state: "failed" as const,
        generationKey: ctx.generationKey,
        message: "Leo could not fix this adventure content safely.",
      };
    }

    contentCandidate = repair.output;
    const rebound = buildGuidedAdventureContentV2({
      ai: contentCandidate,
      sourceLessonId: `session-${ctx.lessonId}`,
    });

    if (!rebound.ok) {
      await markJobStatus(input.jobId, "failed", {
        errorCode: "SCHEMA_VALIDATION_FAILED",
        errorMessage: rebound.message,
      });
      return {
        ok: false as const,
        code: "SCHEMA_VALIDATION_FAILED",
        state: "failed" as const,
        generationKey: ctx.generationKey,
        message: "Leo's adventure did not pass our safety checks.",
      };
    }

    content = rebound.data;
  }

  return {
    ok: false as const,
    code: "UNKNOWN",
    message: "Explore generation ended unexpectedly.",
  };
}

async function runGenerationPipelineSafely(
  input: Parameters<typeof runGenerationPipeline>[0]
): Promise<Awaited<ReturnType<typeof runGenerationPipeline>>> {
  try {
    return await runGenerationPipeline(input);
  } catch (error) {
    await markJobStatus(input.jobId, "failed", {
      errorCode: "GENERATION_EXCEPTION",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Explore generation failed unexpectedly.",
    });

    return {
      ok: false as const,
      code: "GENERATION_EXCEPTION",
      message: "Leo could not prepare this Explore mission right now.",
    };
  }
}

/** Claim and run the Leo pipeline for an existing job (feed kickoff, delivery schedule, etc.). */
export async function runExploreGenerationForClaimedJob(input: {
  auth: LearnMobileStudentContext;
  jobId: Types.ObjectId;
  mode?: ExploreGenerationMode;
}): Promise<void> {
  await connectToDatabase();

  const job = await ExploreGenerationJob.findById(input.jobId).lean<IExploreGenerationJob | null>();
  if (!job) return;

  const resolved = await resolveExploreGenerationContext({
    auth: input.auth,
    lessonId: `session-${job.lessonId}`,
    subjectId: String(job.subjectOfferingId),
  });

  if (!resolved.ok) {
    await markJobStatus(job._id, "failed", {
      errorCode: resolved.code,
      errorMessage: resolved.message,
    });
    return;
  }

  const claimed = await tryClaimExploreGenerationJob(job._id);
  if (!claimed) return;

  await runGenerationPipelineSafely({
    auth: input.auth,
    jobId: claimed._id,
    mode: input.mode ?? job.mode ?? "go_deeper",
    exploreContext: resolved.context,
  });
}

export async function lazyGenerateOrGetExploreAdventure(
  context: LearnMobileStudentContext,
  body: {
    lessonId?: string;
    subjectId?: string;
    mode?: ExploreGenerationMode;
  }
): Promise<
  | { ok: true; data: ExploreGenerateResponse }
  | {
      ok: false;
      code: string;
      message: string;
      friendlyMessage?: string;
      status: number;
    }
> {
  await connectToDatabase();

  const gate = await assertLazyExploreAccess(context);
  if (!gate.ok) return gate;

  const resolved = await resolveExploreGenerationContext({
    auth: context,
    lessonId: body.lessonId,
    subjectId: body.subjectId,
  });

  if (!resolved.ok) {
    return {
      ok: false,
      code: resolved.code,
      message: resolved.message,
      friendlyMessage: resolved.friendlyMessage,
      status: resolved.status,
    };
  }

  const ctx = resolved.context;
  const mode = body.mode ?? "go_deeper";

  const existingReady = await findReadyExploreAdventure({
    schoolId: ctx.schoolId,
    classGroupId: ctx.classGroupId,
    subjectId: ctx.subjectOfferingId,
    lessonId: ctx.lessonId,
    gradeLevel: ctx.gradeLevel,
  });

  if (existingReady) {
    const adventure = await hydrateReadyAdventure({
      auth: context,
      adventureId: existingReady._id,
      relatedLessonTitles: ctx.relatedLessonTitles,
    });

    if (adventure) {
      return {
        ok: true,
        data: {
          state: "ready",
          adventureId: adventure.id,
          adventure,
          generationKey: ctx.generationKey,
        },
      };
    }
  }

  const jobResult = await createExploreGenerationJob({
    schoolId: new Types.ObjectId(ctx.schoolId),
    classGroupId: new Types.ObjectId(ctx.classGroupId),
    subjectOfferingId: new Types.ObjectId(ctx.subjectOfferingId),
    lessonId: new Types.ObjectId(ctx.lessonId),
    gradeLevel: ctx.gradeLevel,
    mode,
    requestedByStudentId: context.studentId,
  });

  if (jobResult.kind === "ready") {
    const adventure = await hydrateReadyAdventure({
      auth: context,
      adventureId: jobResult.adventure._id,
      relatedLessonTitles: ctx.relatedLessonTitles,
    });

    if (adventure) {
      return {
        ok: true,
        data: {
          state: "ready",
          adventureId: adventure.id,
          adventure,
          generationKey: jobResult.generationKey,
        },
      };
    }
  }

  if (jobResult.kind === "failed") {
    const fallbackAdventures = await loadFallbackExploreAdventures({
      auth: context,
      excludeGenerationKey: jobResult.generationKey,
    });

    return {
      ok: true,
      data: {
        state: jobResult.job.status === "blocked" ? "blocked" : "failed",
        generationKey: jobResult.generationKey,
        message: jobResult.message,
        fallbackAdventures,
      },
    };
  }

  if (jobResult.kind === "generating") {
    const fallbackAdventures = await loadFallbackExploreAdventures({
      auth: context,
      excludeGenerationKey: jobResult.generationKey,
    });

    const state =
      jobResult.job.status === "safety_checking"
        ? "safety_checking"
        : jobResult.job.status === "repairing"
          ? "repairing"
          : "generating";

    return {
      ok: true,
      data: {
        state,
        generationKey: jobResult.generationKey,
        message: jobResult.message,
        retryAfterSeconds: jobResult.retryAfterSeconds,
        fallbackAdventures,
      },
    };
  }

  if (jobResult.kind !== "job_created") {
    return {
      ok: false,
      code: "GENERATION_IN_PROGRESS",
      message: "Explore generation is already in progress.",
      friendlyMessage: "Leo is preparing this Explore mission.",
      status: 409,
    };
  }

  const claimed = await tryClaimExploreGenerationJob(jobResult.job._id);

  if (!claimed) {
    const freshJob = await ExploreGenerationJob.findById(jobResult.job._id).lean();
    const fallbackAdventures = await loadFallbackExploreAdventures({
      auth: context,
      excludeGenerationKey: ctx.generationKey,
    });

    const state =
      freshJob?.status === "safety_checking"
        ? "safety_checking"
        : freshJob?.status === "repairing"
          ? "repairing"
          : freshJob?.status === "ready"
            ? "generating"
            : "generating";

    if (freshJob?.status === "ready" && freshJob.adventureId) {
      const adventure = await hydrateReadyAdventure({
        auth: context,
        adventureId: freshJob.adventureId,
        relatedLessonTitles: ctx.relatedLessonTitles,
      });

      if (adventure) {
        return {
          ok: true,
          data: {
            state: "ready",
            adventureId: adventure.id,
            adventure,
            generationKey: ctx.generationKey,
          },
        };
      }
    }

    return {
      ok: true,
      data: {
        state: state === "generating" ? state : "generating",
        generationKey: ctx.generationKey,
        message: "Leo is preparing this Explore mission.",
        retryAfterSeconds: EXPLORE_GENERATION_RETRY_AFTER_SECONDS,
        fallbackAdventures,
      },
    };
  }

  const pipeline = await runGenerationPipelineSafely({
    auth: context,
    jobId: claimed._id,
    mode,
    exploreContext: ctx,
  });

  if (pipeline.ok) {
    return {
      ok: true,
      data: {
        state: "ready",
        adventureId: pipeline.adventureId,
        adventure: pipeline.adventure,
        generationKey: pipeline.generationKey,
      },
    };
  }

  const fallbackAdventures = await loadFallbackExploreAdventures({
    auth: context,
    excludeGenerationKey: ctx.generationKey,
  });

  if ("state" in pipeline && pipeline.state === "blocked") {
    return {
      ok: true,
      data: {
        state: "blocked",
        generationKey: pipeline.generationKey,
        message: pipeline.message,
        fallbackAdventures,
      },
    };
  }

  return {
    ok: true,
    data: {
      state: "failed",
      generationKey: ctx.generationKey,
      message: pipeline.message ?? "Leo could not prepare this Explore mission.",
      fallbackAdventures,
    },
  };
}

export type AdminRegenerateExploreResult =
  | {
      ok: true;
      state: "ready";
      adventureId: string;
      message: string;
    }
  | {
      ok: true;
      state: "generating" | "failed" | "blocked";
      generationKey: string;
      message: string;
      retryAfterSeconds?: number;
    }
  | { ok: false; message: string };

/** Regenerate Explore content for an existing class adventure (admin/teacher QA). */
export async function adminRegenerateExploreAdventure(input: {
  schoolId: Types.ObjectId;
  reviewerId: Types.ObjectId;
  adventureId: string;
  mode?: ExploreGenerationMode;
}): Promise<AdminRegenerateExploreResult> {
  await connectToDatabase();

  const objectIdHex = parseExploreAdventureId(input.adventureId);
  if (!objectIdHex) {
    return { ok: false, message: "Invalid adventure id." };
  }

  const adventure = await ExploreAdventure.findOne({
    _id: new Types.ObjectId(objectIdHex),
    schoolId: input.schoolId,
  }).lean<IExploreAdventure | null>();

  if (!adventure) {
    return { ok: false, message: "Explore adventure not found." };
  }

  const lesson = await loadCoveredLessonSessionById({
    schoolId: input.schoolId,
    classGroupId: adventure.classGroupId,
    sessionId: adventure.lessonId,
    select: "_id title subjectOfferingId ownerTeacherId planNotes contentBlocks",
  });

  if (!lesson) {
    return {
      ok: false,
      message: "Source lesson is no longer available for this class. Cannot regenerate.",
    };
  }

  const lessonBrief = buildExploreLessonBrief(lesson);
  const generationKey = buildExploreGenerationKey({
    schoolId: adventure.schoolId,
    classGroupId: adventure.classGroupId,
    subjectId: adventure.subjectOfferingId,
    lessonId: adventure.lessonId,
    gradeLevel: adventure.gradeLevel,
  });

  const exploreContext: ResolvedExploreGenerationContext = {
    studentId: String(input.reviewerId),
    schoolId: String(adventure.schoolId),
    classGroupId: String(adventure.classGroupId),
    gradeId: null,
    gradeLevel: adventure.gradeLevel,
    gradeName: adventure.gradeLevel,
    subjectOfferingId: String(adventure.subjectOfferingId),
    subjectName: adventure.subjectName,
    lessonId: String(adventure.lessonId),
    lessonTitle: adventure.sourceLessonTitle,
    lessonBrief,
    sourceContext: {
      schoolId: String(adventure.schoolId),
      classGroupId: String(adventure.classGroupId),
      subjectId: String(adventure.subjectOfferingId),
      lessonId: String(adventure.lessonId),
      lessonTitle: adventure.sourceLessonTitle,
      gradeLevel: adventure.gradeLevel,
    },
    generationKey,
    relatedLessonTitles: [],
    flashcardHints: [],
  };

  const auth: LearnMobileStudentContext = {
    schoolId: input.schoolId,
    studentId: input.reviewerId,
    sessionId: input.reviewerId,
    accountId: input.reviewerId,
    gradeId: null,
    classGroupId: adventure.classGroupId,
    mustChangePassword: false,
  };

  const mode = input.mode ?? "go_deeper";

  let job: IExploreGenerationJob | null = await ExploreGenerationJob.findOne({
    generationKey,
  }).lean<IExploreGenerationJob | null>();

  if (!job) {
    const created = await ExploreGenerationJob.create({
      generationKey,
      schoolId: input.schoolId,
      classGroupId: adventure.classGroupId,
      subjectOfferingId: adventure.subjectOfferingId,
      lessonId: adventure.lessonId,
      gradeLevel: adventure.gradeLevel,
      mode,
      status: "pending",
      adventureId: adventure._id,
      requestedByStudentId: input.reviewerId,
      attempts: 0,
      maxAttempts: 3,
    });
    job = created.toObject() as IExploreGenerationJob;
  } else if (
    job.status === "generating" ||
    job.status === "safety_checking" ||
    job.status === "repairing" ||
    job.status === "pending"
  ) {
    return {
      ok: true,
      state: "generating",
      generationKey,
      message: "Leo is already regenerating this mission.",
      retryAfterSeconds: EXPLORE_GENERATION_RETRY_AFTER_SECONDS,
    };
  } else {
    await markJobStatus(job._id, "pending", {
      adventureId: adventure._id,
      errorCode: null,
      errorMessage: null,
    });
    job = await ExploreGenerationJob.findById(job._id).lean<IExploreGenerationJob | null>();
  }

  if (!job) {
    return { ok: false, message: "Could not start regeneration job." };
  }

  const claimed = await tryClaimExploreGenerationJob(job._id);
  if (!claimed) {
    return {
      ok: true,
      state: "generating",
      generationKey: exploreContext.generationKey,
      message: "Leo is already regenerating this mission.",
      retryAfterSeconds: EXPLORE_GENERATION_RETRY_AFTER_SECONDS,
    };
  }

  const pipeline = await runGenerationPipelineSafely({
    auth,
    jobId: claimed._id,
    mode,
    exploreContext,
    existingAdventureId: adventure._id,
  });

  if (pipeline.ok) {
    return {
      ok: true,
      state: "ready",
      adventureId: pipeline.adventureId,
      message: "Leo regenerated this Explore mission with a new content snapshot.",
    };
  }

  if ("state" in pipeline && pipeline.state === "blocked") {
    return {
      ok: true,
      state: "blocked",
      generationKey: pipeline.generationKey,
      message: pipeline.message,
    };
  }

  return {
    ok: true,
    state: "failed",
    generationKey: exploreContext.generationKey,
    message: pipeline.message ?? "Regeneration failed.",
  };
}
