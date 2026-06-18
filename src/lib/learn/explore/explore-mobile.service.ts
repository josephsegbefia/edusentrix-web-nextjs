import "server-only";

import { Types } from "mongoose";

import { connectToDatabase } from "@/db/connectToDatabase";
import {
  buildExploreAdventureId,
  parseExploreAdventureId,
} from "@/lib/learn/explore/build-generation-key";
import {
  ensureStudentExploreRecord,
  loadExploreSnapshotForAdventure,
  serializeExploreAdventureForStudent,
  type MobileExploreAdventurePayload,
} from "@/lib/learn/explore/explore-content.service";
import {
  createExploreGenerationJob,
  EXPLORE_GENERATION_RETRY_AFTER_SECONDS,
} from "@/lib/learn/explore/explore-generation.service";
import { runExploreGenerationForClaimedJob } from "@/lib/learn/explore/explore-lazy-generate.service";
import type { ExploreGenerationJobStatus } from "@/lib/learn/explore/explore-types";
import {
  buildQuizSubmitResponse,
  gradeExploreQuizAttempt,
} from "@/lib/learn/explore-adventure-content";
import type { LearnMobileStudentContext } from "@/lib/learn/mobile-auth";
import { getStudentLearnAccess } from "@/lib/learn/access";
import { recordLearnMobileActivity } from "@/lib/learn/mobile-activity";
import { loadMobileStudentBundle } from "@/lib/learn/mobile-student-profile";
import { ExploreAdventure, type IExploreAdventure } from "@/models/ExploreAdventure";
import { ExploreContentReview } from "@/models/ExploreContentReview";
import { ExploreContentSnapshot } from "@/models/ExploreContentSnapshot";
import {
  ExploreGenerationJob,
  type IExploreGenerationJob,
} from "@/models/ExploreGenerationJob";
import { Student } from "@/models/Student";
import { StudentExploreRecord, type IStudentExploreRecord } from "@/models/StudentExploreRecord";
import {
  buildExploreCompleteReward,
  type ExploreCompleteRewardPayload,
} from "@/lib/learn/explore/explore-completion-rewards";

const READY_ADVENTURE_STATUSES = ["teacher_approved"] as const;

const IN_PROGRESS_JOB_STATUSES: ExploreGenerationJobStatus[] = [
  "pending",
  "generating",
  "safety_checking",
  "repairing",
];

export type GuidedAdventuresFeedData = {
  studentId: string;
  introMessage: string;
  recommendedAdventureId: string;
  subjects: string[];
  adventures: Array<
    Omit<
      MobileExploreAdventurePayload,
      "deepDiveExplanation" | "misconceptions" | "tryItActivity" | "parentConversationPrompt" | "curiosityPathways"
    > &
      Partial<
        Pick<
          MobileExploreAdventurePayload,
          | "deepDiveExplanation"
          | "misconceptions"
          | "tryItActivity"
          | "parentConversationPrompt"
          | "curiosityPathways"
        >
      >
  >;
  pendingGeneration?: {
    state: "generating" | "safety_checking" | "repairing";
    generationKey: string;
    message: string;
    retryAfterSeconds: number;
  };
};

export type ExploreGenerationStatusResponse = {
  state:
    | "generating"
    | "safety_checking"
    | "repairing"
    | "ready"
    | "failed"
    | "blocked";
  generationKey: string;
  message: string;
  retryAfterSeconds?: number;
  adventure?: MobileExploreAdventurePayload;
};

export type ExploreStudentRecordRow = {
  adventureId: string;
  title: string;
  subjectName: string;
  sourceLessonTitle: string;
  contentSnapshotId: string;
  status: IStudentExploreRecord["status"];
  quizScorePercent?: number;
  correctCount?: number;
  totalCount?: number;
  startedAt?: string;
  submittedAt?: string;
  completedAt?: string;
  updatedAt: string;
};

export type ExploreRecordsData = {
  studentId: string;
  records: ExploreStudentRecordRow[];
};

export type ExploreReportReason =
  | "too_hard"
  | "too_easy"
  | "not_related"
  | "unsafe_or_inappropriate"
  | "confusing"
  | "wrong_information"
  | "other";

async function assertExploreMobileAccess(context: LearnMobileStudentContext) {
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
      status: 403,
    };
  }

  if (!context.classGroupId) {
    return {
      ok: false as const,
      code: "NO_STUDENT_PROFILE",
      message: "Class group not found.",
      status: 404,
    };
  }

  return { ok: true as const };
}

async function loadClassExploreAdventure(
  context: LearnMobileStudentContext,
  adventureId: string
) {
  const objectId = parseExploreAdventureId(adventureId);
  if (!objectId) return null;

  const adventure = await ExploreAdventure.findOne({
    _id: objectId,
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    status: { $in: READY_ADVENTURE_STATUSES },
  }).lean<IExploreAdventure | null>();

  if (!adventure) return null;

  const loaded = await loadExploreSnapshotForAdventure(adventure._id);
  if (!loaded) return null;

  return loaded;
}

async function validateSnapshotForAdventure(input: {
  adventureObjectId: Types.ObjectId;
  contentSnapshotId: string;
}) {
  if (!Types.ObjectId.isValid(input.contentSnapshotId)) {
    return { ok: false as const, code: "INVALID_SNAPSHOT", message: "Invalid content snapshot id." };
  }

  const snapshot = await ExploreContentSnapshot.findById(input.contentSnapshotId).lean();
  if (!snapshot) {
    return { ok: false as const, code: "SNAPSHOT_NOT_FOUND", message: "Content snapshot not found." };
  }

  if (String(snapshot.adventureId) !== String(input.adventureObjectId)) {
    return {
      ok: false as const,
      code: "SNAPSHOT_MISMATCH",
      message: "Content snapshot does not match this adventure.",
    };
  }

  return { ok: true as const, snapshot };
}

function jobStateToPollStatus(
  status: ExploreGenerationJobStatus
): ExploreGenerationStatusResponse["state"] {
  if (status === "ready") return "ready";
  if (status === "failed") return "failed";
  if (status === "blocked") return "blocked";
  if (status === "safety_checking") return "safety_checking";
  if (status === "repairing") return "repairing";
  return "generating";
}

function pendingMessage(status: ExploreGenerationJobStatus) {
  if (status === "safety_checking") {
    return "Leo is checking this Explore mission for safety.";
  }
  if (status === "repairing") {
    return "Leo is polishing this Explore mission.";
  }
  return "Leo is preparing this Explore mission.";
}

async function hydrateAdventurePayload(input: {
  context: LearnMobileStudentContext;
  adventure: IExploreAdventure;
  markStarted?: boolean;
}) {
  const loaded = await loadExploreSnapshotForAdventure(input.adventure._id);
  if (!loaded) return null;

  let record = await StudentExploreRecord.findOne({
    studentId: input.context.studentId,
    adventureId: input.adventure._id,
  }).lean<IStudentExploreRecord | null>();

  if (!record) {
    record = await ensureStudentExploreRecord({
      auth: input.context,
      adventureId: input.adventure._id,
      contentSnapshotId: loaded.snapshot._id,
    });
  } else if (input.markStarted && record.status === "not_started") {
    record = (await StudentExploreRecord.findOneAndUpdate(
      { _id: record._id },
      { $set: { status: "in_progress", startedAt: new Date() } },
      { new: true }
    ).lean()) as IStudentExploreRecord;
  }

  const payload = serializeExploreAdventureForStudent({
    adventure: loaded.adventure,
    snapshot: loaded.snapshot,
    studentId: String(input.context.studentId),
    record,
    sourceContext: loaded.snapshot.sourceContext,
  });

  if (record?.status !== "completed") {
    return payload;
  }

  const completedExploreCount = await StudentExploreRecord.countDocuments({
    studentId: input.context.studentId,
    status: "completed",
  });

  const completionRewards: ExploreCompleteRewardPayload = buildExploreCompleteReward({
    estimatedMinutes: loaded.adventure.estimatedMinutes,
    difficulty: loaded.adventure.difficulty,
    quizScorePercent: record.quizScorePercent ?? 0,
    completedExploreCount,
  });

  return { ...payload, completionRewards };
}

export async function buildLazyExploreAdventuresFeed(context: LearnMobileStudentContext) {
  await connectToDatabase();
  const gate = await assertExploreMobileAccess(context);
  if (!gate.ok) return gate;

  const bundle = await loadMobileStudentBundle({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
  });

  if (!bundle) {
    return {
      ok: false as const,
      code: "NO_STUDENT_PROFILE",
      message: "Student profile not found.",
      status: 404,
    };
  }

  const adventures = await ExploreAdventure.find({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    status: { $in: READY_ADVENTURE_STATUSES },
  })
    .sort({ updatedAt: -1 })
    .limit(24)
    .lean<IExploreAdventure[]>();

  const payloads: MobileExploreAdventurePayload[] = [];

  for (const adventure of adventures) {
    const payload = await hydrateAdventurePayload({ context, adventure });
    if (payload) payloads.push(payload);
  }

  const activeJob = await ExploreGenerationJob.findOne({
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
    status: { $in: IN_PROGRESS_JOB_STATUSES },
  })
    .sort({ updatedAt: -1 })
    .lean();

  const recommended =
    payloads.find((a) => a.studentRecord.status !== "completed") ?? payloads[0];

  const subjects = Array.from(new Set(payloads.map((a) => a.subjectName)));

  const feed: GuidedAdventuresFeedData = {
    studentId: String(context.studentId),
    introMessage:
      "Your class already learned the basics — these missions go deeper with Leo, without repeating the same lesson notes.",
    recommendedAdventureId: recommended?.id ?? "",
    subjects: ["All", ...subjects],
    adventures: payloads,
  };

  if (activeJob) {
    const pollState = jobStateToPollStatus(activeJob.status);
    if (pollState === "generating" || pollState === "safety_checking" || pollState === "repairing") {
      feed.pendingGeneration = {
        state: pollState,
        generationKey: activeJob.generationKey,
        message: pendingMessage(activeJob.status),
        retryAfterSeconds: EXPLORE_GENERATION_RETRY_AFTER_SECONDS,
      };
    }
  }

  return { ok: true as const, data: feed };
}

export async function buildLazyExploreAdventureDetail(
  context: LearnMobileStudentContext,
  adventureId: string
) {
  await connectToDatabase();
  const gate = await assertExploreMobileAccess(context);
  if (!gate.ok) return gate;

  const loaded = await loadClassExploreAdventure(context, adventureId);
  if (!loaded) {
    return {
      ok: false as const,
      code: "ADVENTURE_NOT_FOUND",
      message: "Adventure not found.",
      status: 404,
    };
  }

  const payload = await hydrateAdventurePayload({
    context,
    adventure: loaded.adventure,
    markStarted: true,
  });

  if (!payload) {
    return {
      ok: false as const,
      code: "ADVENTURE_NOT_FOUND",
      message: "Adventure content not found.",
      status: 404,
    };
  }

  return { ok: true as const, data: payload };
}

export async function getLazyExploreGenerationStatus(
  context: LearnMobileStudentContext,
  generationKey: string
) {
  await connectToDatabase();
  const gate = await assertExploreMobileAccess(context);
  if (!gate.ok) return gate;

  const trimmedKey = generationKey.trim();
  if (!trimmedKey) {
    return {
      ok: false as const,
      code: "VALIDATION_ERROR",
      message: "generationKey is required.",
      status: 400,
    };
  }

  let job = await ExploreGenerationJob.findOne({
    generationKey: trimmedKey,
    schoolId: context.schoolId,
    classGroupId: context.classGroupId,
  }).lean<IExploreGenerationJob | null>();

  if (!job) {
    return {
      ok: false as const,
      code: "JOB_NOT_FOUND",
      message: "Generation job not found.",
      status: 404,
    };
  }

  const refreshed = await createExploreGenerationJob({
    schoolId: job.schoolId,
    classGroupId: job.classGroupId,
    subjectOfferingId: job.subjectOfferingId,
    lessonId: job.lessonId,
    gradeLevel: job.gradeLevel,
    mode: job.mode,
    requestedByStudentId: context.studentId,
  });

  if (refreshed.kind === "job_created") {
    await runExploreGenerationForClaimedJob({
      auth: context,
      jobId: refreshed.job._id,
      mode: refreshed.job.mode,
    });

    job = await ExploreGenerationJob.findById(refreshed.job._id).lean<IExploreGenerationJob | null>();
    if (!job) job = refreshed.job;
  } else if (refreshed.kind === "ready") {
    const payload = await hydrateAdventurePayload({
      context,
      adventure: refreshed.adventure,
    });

    return {
      ok: true as const,
      data: {
        state: "ready" as const,
        generationKey: trimmedKey,
        message: "Your Explore mission is ready.",
        adventure: payload ?? undefined,
      },
    };
  } else {
    job = refreshed.job;
  }

  const state = jobStateToPollStatus(job.status);
  const response: ExploreGenerationStatusResponse = {
    state,
    generationKey: trimmedKey,
    message:
      job.errorMessage ??
      (state === "ready"
        ? "Your Explore mission is ready."
        : state === "failed" || state === "blocked"
          ? "Leo could not finish preparing this mission."
          : pendingMessage(job.status)),
    retryAfterSeconds:
      state === "generating" || state === "safety_checking" || state === "repairing"
        ? EXPLORE_GENERATION_RETRY_AFTER_SECONDS
        : undefined,
  };

  if (state === "ready" && job.adventureId) {
    const adventure = await ExploreAdventure.findById(job.adventureId).lean<IExploreAdventure | null>();
    if (adventure) {
      const payload = await hydrateAdventurePayload({ context, adventure });
      if (payload) response.adventure = payload;
    }
  }

  return { ok: true as const, data: response };
}

export async function submitLazyExploreAdventureQuiz(
  context: LearnMobileStudentContext,
  adventureId: string,
  body: {
    contentSnapshotId: string;
    answers: Array<{ questionId: string; selectedOptionId: string }>;
  }
) {
  await connectToDatabase();
  const gate = await assertExploreMobileAccess(context);
  if (!gate.ok) return gate;

  const loaded = await loadClassExploreAdventure(context, adventureId);
  if (!loaded) {
    return {
      ok: false as const,
      code: "ADVENTURE_NOT_FOUND",
      message: "Adventure not found.",
      status: 404,
    };
  }

  const snapshotCheck = await validateSnapshotForAdventure({
    adventureObjectId: loaded.adventure._id,
    contentSnapshotId: body.contentSnapshotId,
  });

  if (!snapshotCheck.ok) {
    return {
      ok: false as const,
      code: snapshotCheck.code,
      message: snapshotCheck.message,
      status: snapshotCheck.code === "SNAPSHOT_MISMATCH" ? 400 : 404,
    };
  }

  const quiz = snapshotCheck.snapshot.content.endingQuiz;
  if (!quiz?.questions?.length) {
    return {
      ok: false as const,
      code: "QUIZ_NOT_READY",
      message: "Adventure quiz not ready.",
      status: 404,
    };
  }

  let record = await StudentExploreRecord.findOne({
    studentId: context.studentId,
    adventureId: loaded.adventure._id,
  }).lean<IStudentExploreRecord | null>();

  if (!record) {
    record = await ensureStudentExploreRecord({
      auth: context,
      adventureId: loaded.adventure._id,
      contentSnapshotId: snapshotCheck.snapshot._id,
    });
  }

  if (record.quizSubmittedAt) {
    const priorAttempt = {
      submittedAt: record.quizSubmittedAt.toISOString(),
      answers: (record.answers ?? []).map((row) => ({
        questionId: row.questionId,
        selectedOptionId: row.selectedOptionId,
        correct: row.correct,
      })),
      scorePercent: record.quizScorePercent ?? 0,
      correctCount: record.correctCount ?? 0,
      totalCount: record.totalCount ?? quiz.questions.length,
    };
    return {
      ok: true as const,
      data: buildQuizSubmitResponse(quiz, priorAttempt),
    };
  }

  const attempt = gradeExploreQuizAttempt(quiz, body.answers);

  await StudentExploreRecord.updateOne(
    { _id: record._id },
    {
      $set: {
        contentSnapshotId: snapshotCheck.snapshot._id,
        status: "quiz_submitted",
        quizSubmittedAt: new Date(),
        quizScorePercent: attempt.scorePercent,
        correctCount: attempt.correctCount,
        totalCount: attempt.totalCount,
        answers: attempt.answers,
        startedAt: record.startedAt ?? new Date(),
      },
    }
  );

  await recordLearnMobileActivity({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
    gradeId: context.gradeId,
    classGroupId: context.classGroupId,
    eventType: "explore_with_leo",
    topic: loaded.adventure.title,
    score: attempt.scorePercent,
    metadata: {
      adventureId,
      contentSnapshotId: body.contentSnapshotId,
      phase: "quiz_submitted",
      correctCount: attempt.correctCount,
      totalCount: attempt.totalCount,
    },
  });

  return { ok: true as const, data: buildQuizSubmitResponse(quiz, attempt) };
}

export async function completeLazyExploreAdventure(
  context: LearnMobileStudentContext,
  adventureId: string,
  body: { contentSnapshotId: string; quizScorePercent?: number }
) {
  await connectToDatabase();
  const gate = await assertExploreMobileAccess(context);
  if (!gate.ok) return gate;

  const loaded = await loadClassExploreAdventure(context, adventureId);
  if (!loaded) {
    return {
      ok: false as const,
      code: "ADVENTURE_NOT_FOUND",
      message: "Adventure not found.",
      status: 404,
    };
  }

  const snapshotCheck = await validateSnapshotForAdventure({
    adventureObjectId: loaded.adventure._id,
    contentSnapshotId: body.contentSnapshotId,
  });

  if (!snapshotCheck.ok) {
    return {
      ok: false as const,
      code: snapshotCheck.code,
      message: snapshotCheck.message,
      status: snapshotCheck.code === "SNAPSHOT_MISMATCH" ? 400 : 404,
    };
  }

  const record = await StudentExploreRecord.findOne({
    studentId: context.studentId,
    adventureId: loaded.adventure._id,
  }).lean<IStudentExploreRecord | null>();

  if (!record?.quizSubmittedAt) {
    return {
      ok: false as const,
      code: "QUIZ_REQUIRED",
      message: "Complete the quick Explore quiz before finishing this adventure.",
      status: 400,
    };
  }

  const completedAt = new Date();
  const scorePercent = body.quizScorePercent ?? record.quizScorePercent ?? 0;

  await StudentExploreRecord.updateOne(
    { _id: record._id },
    {
      $set: {
        contentSnapshotId: snapshotCheck.snapshot._id,
        status: "completed",
        completedAt,
        quizScorePercent: scorePercent,
      },
    }
  );

  const completedExploreCount = await StudentExploreRecord.countDocuments({
    studentId: context.studentId,
    status: "completed",
  });

  const rewards = buildExploreCompleteReward({
    estimatedMinutes: loaded.adventure.estimatedMinutes,
    difficulty: loaded.adventure.difficulty,
    quizScorePercent: scorePercent,
    completedExploreCount,
  });

  await recordLearnMobileActivity({
    schoolId: context.schoolId,
    studentId: context.studentId,
    accountId: context.accountId,
    gradeId: context.gradeId,
    classGroupId: context.classGroupId,
    eventType: "explore_with_leo",
    topic: loaded.adventure.title,
    metadata: {
      adventureId,
      contentSnapshotId: body.contentSnapshotId,
      phase: "completed",
      score: scorePercent,
      xpAwarded: rewards.xpAwarded,
      badgeId: rewards.badge.id,
      badgeEarned: rewards.badge.earned,
    },
    score: scorePercent,
  });

  return {
    ok: true as const,
    data: {
      adventureId: buildExploreAdventureId(loaded.adventure._id),
      completed: true,
      completedAt: completedAt.toISOString(),
      quizScorePercent: scorePercent,
      xpAwarded: rewards.xpAwarded,
      badge: rewards.badge,
      celebrationMessage: rewards.celebrationMessage,
    },
  };
}

function mapReportReasonToAction(reason: ExploreReportReason) {
  switch (reason) {
    case "too_hard":
      return "marked_too_hard" as const;
    case "too_easy":
      return "marked_too_easy" as const;
    case "not_related":
      return "marked_not_relevant" as const;
    default:
      return "reported" as const;
  }
}

export async function reportLazyExploreAdventure(
  context: LearnMobileStudentContext,
  adventureId: string,
  body: { contentSnapshotId: string; reason: ExploreReportReason; note?: string }
) {
  await connectToDatabase();
  const gate = await assertExploreMobileAccess(context);
  if (!gate.ok) return gate;

  const loaded = await loadClassExploreAdventure(context, adventureId);
  if (!loaded) {
    return {
      ok: false as const,
      code: "ADVENTURE_NOT_FOUND",
      message: "Adventure not found.",
      status: 404,
    };
  }

  const snapshotCheck = await validateSnapshotForAdventure({
    adventureObjectId: loaded.adventure._id,
    contentSnapshotId: body.contentSnapshotId,
  });

  if (!snapshotCheck.ok) {
    return {
      ok: false as const,
      code: snapshotCheck.code,
      message: snapshotCheck.message,
      status: snapshotCheck.code === "SNAPSHOT_MISMATCH" ? 400 : 404,
    };
  }

  const student = await Student.findOne({
    _id: context.studentId,
    schoolId: context.schoolId,
  })
    .select("userId")
    .lean<{ userId?: Types.ObjectId | null } | null>();

  const reviewerId = student?.userId ?? context.studentId;

  const action = mapReportReasonToAction(body.reason);

  await ExploreContentReview.create({
    adventureId: loaded.adventure._id,
    contentSnapshotId: snapshotCheck.snapshot._id,
    schoolId: context.schoolId,
    reviewerId,
    reviewerRole: "parent",
    action,
    reason: body.reason,
    notes: body.note?.trim() || null,
    reportedByStudentId: context.studentId,
  });

  if (body.reason === "unsafe_or_inappropriate") {
    await ExploreAdventure.updateOne(
      { _id: loaded.adventure._id },
      { $set: { status: "reported", reviewStatus: "needs_changes" } }
    );
  }

  return {
    ok: true as const,
    data: {
      adventureId: buildExploreAdventureId(loaded.adventure._id),
      reported: true,
      reason: body.reason,
      message: "Thanks for telling Leo. Your teacher can review this mission.",
    },
  };
}

export async function listLazyExploreRecords(context: LearnMobileStudentContext) {
  await connectToDatabase();
  const gate = await assertExploreMobileAccess(context);
  if (!gate.ok) return gate;

  const records = await StudentExploreRecord.find({
    studentId: context.studentId,
    schoolId: context.schoolId,
  })
    .sort({ updatedAt: -1 })
    .limit(50)
    .lean<IStudentExploreRecord[]>();

  const rows: ExploreStudentRecordRow[] = [];

  for (const record of records) {
    const adventure = await ExploreAdventure.findById(record.adventureId)
      .select("title subjectName sourceLessonTitle status")
      .lean<{
        title: string;
        subjectName: string;
        sourceLessonTitle: string;
        status: string;
      } | null>();

    if (!adventure || adventure.status === "blocked" || adventure.status === "hidden") {
      continue;
    }

    rows.push({
      adventureId: buildExploreAdventureId(record.adventureId),
      title: adventure.title,
      subjectName: adventure.subjectName,
      sourceLessonTitle: adventure.sourceLessonTitle,
      contentSnapshotId: String(record.contentSnapshotId),
      status: record.status,
      quizScorePercent: record.quizScorePercent ?? undefined,
      correctCount: record.correctCount ?? undefined,
      totalCount: record.totalCount ?? undefined,
      startedAt: record.startedAt?.toISOString(),
      submittedAt: record.quizSubmittedAt?.toISOString(),
      completedAt: record.completedAt?.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    });
  }

  return {
    ok: true as const,
    data: {
      studentId: String(context.studentId),
      records: rows,
    } satisfies ExploreRecordsData,
  };
}
