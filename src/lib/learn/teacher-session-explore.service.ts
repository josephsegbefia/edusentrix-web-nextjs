import "server-only";

import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { buildExploreAdventureId } from "@/lib/learn/explore/build-generation-key";
import {
  buildExploreWorkerContextForClass,
  resolveGradeLevelForClassGroup,
} from "@/lib/learn/explore/explore-class-context";
import {
  createExploreGenerationJob,
  findReadyExploreAdventure,
} from "@/lib/learn/explore/explore-generation.service";
import { runExploreGenerationForClaimedJob } from "@/lib/learn/explore/explore-lazy-generate.service";
import { loadExploreSnapshotForAdventure } from "@/lib/learn/explore/explore-content.service";
import { applyTeacherExploreAdminReview } from "@/lib/learn/learn-explore-qa";
import {
  getLazyExploreDetailForAdminQa,
  updateLazyExploreContentForAdminQa,
} from "@/lib/learn/learn-explore-admin-qa";
import type { GuidedAdventureContentV2 } from "@/lib/learn/explore/explore-types";
import { canManageLessonSessionContent, canReadLessonSession } from "@/lib/lessons/session-access";
import { loadLessonSessionForTeacher } from "@/lib/lessons/load-lesson-session";
import { ExploreAdventure } from "@/models/ExploreAdventure";
import { ExploreGenerationJob } from "@/models/ExploreGenerationJob";
import { LessonDelivery } from "@/models/LessonDelivery";
import { LessonSession } from "@/models/LessonSession";

export type TeacherSessionExploreStatus = {
  sessionId: string;
  adventureId: string | null;
  generationKey: string | null;
  status: "not_started" | "generating" | "ready_for_review" | "published" | "failed";
  title: string | null;
  introPreview: string | null;
  estimatedMinutes: number | null;
  message: string;
};

function serializeStatus(input: {
  sessionId: string;
  adventure?: {
    _id: Types.ObjectId;
    generationKey: string;
    status: string;
    title: string;
    estimatedMinutes?: number;
  } | null;
  job?: { status: string } | null;
  introPreview?: string | null;
}): TeacherSessionExploreStatus {
  if (input.adventure?.status === "teacher_approved") {
    return {
      sessionId: input.sessionId,
      adventureId: buildExploreAdventureId(input.adventure._id),
      generationKey: input.adventure.generationKey,
      status: "published",
      title: input.adventure.title,
      introPreview: input.introPreview ?? null,
      estimatedMinutes: input.adventure.estimatedMinutes ?? null,
      message: "Published to EduSentrix Learn. All students in this class see the same mission.",
    };
  }

  if (
    input.adventure &&
    ["ready", "teacher_review_recommended"].includes(input.adventure.status)
  ) {
    return {
      sessionId: input.sessionId,
      adventureId: buildExploreAdventureId(input.adventure._id),
      generationKey: input.adventure.generationKey,
      status: "ready_for_review",
      title: input.adventure.title,
      introPreview: input.introPreview ?? null,
      estimatedMinutes: input.adventure.estimatedMinutes ?? null,
      message: "Explore mission is ready. Review and publish when you are happy with it.",
    };
  }

  if (
    input.job &&
    ["pending", "generating", "safety_checking", "repairing"].includes(input.job.status)
  ) {
    return {
      sessionId: input.sessionId,
      adventureId: input.adventure
        ? buildExploreAdventureId(input.adventure._id)
        : null,
      generationKey: input.adventure?.generationKey ?? null,
      status: "generating",
      title: input.adventure?.title ?? null,
      introPreview: null,
      estimatedMinutes: input.adventure?.estimatedMinutes ?? null,
      message: "Leo is building a safe, age-appropriate Explore mission for this lesson.",
    };
  }

  if (input.job?.status === "failed" || input.job?.status === "blocked") {
    return {
      sessionId: input.sessionId,
      adventureId: null,
      generationKey: null,
      status: "failed",
      title: null,
      introPreview: null,
      estimatedMinutes: null,
      message: "Explore generation did not finish safely. Try generating again.",
    };
  }

  return {
    sessionId: input.sessionId,
    adventureId: null,
    generationKey: null,
    status: "not_started",
    title: null,
    introPreview: null,
    estimatedMinutes: null,
    message:
      "Generate an Explore mission after class so students can go deeper on this lesson together.",
  };
}

async function resolveExploreClassGroupForSession(input: {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  classGroupId?: string | Types.ObjectId | null;
}): Promise<Types.ObjectId | null> {
  const session = await LessonSession.findOne({
    _id: input.sessionId,
    schoolId: input.schoolId,
  })
    .select("classGroupId")
    .lean<{ classGroupId: Types.ObjectId } | null>();

  if (!session?.classGroupId) return null;

  if (input.classGroupId && Types.ObjectId.isValid(String(input.classGroupId))) {
    const requested = new Types.ObjectId(String(input.classGroupId));
    if (requested.equals(session.classGroupId)) return requested;

    const delivery = await LessonDelivery.findOne({
      sessionId: input.sessionId,
      schoolId: input.schoolId,
      classGroupId: requested,
    }).lean();

    if (delivery) return requested;
  }

  return session.classGroupId;
}

export async function getTeacherSessionExploreStatus(input: {
  schoolId: Types.ObjectId;
  sessionId: Types.ObjectId;
  classGroupId?: string | Types.ObjectId | null;
}): Promise<TeacherSessionExploreStatus | null> {
  await connectToDatabase();

  const classGroupId = await resolveExploreClassGroupForSession(input);
  if (!classGroupId) return null;

  const session = await LessonSession.findOne({
    _id: input.sessionId,
    schoolId: input.schoolId,
  })
    .select("_id subjectOfferingId")
    .lean<{
      _id: Types.ObjectId;
      subjectOfferingId: Types.ObjectId;
    } | null>();

  if (!session?.subjectOfferingId) return null;

  const gradeLevel = await resolveGradeLevelForClassGroup({
    schoolId: input.schoolId,
    classGroupId,
  });

  const adventure = await findReadyExploreAdventure({
    schoolId: input.schoolId,
    classGroupId,
    subjectId: session.subjectOfferingId,
    lessonId: session._id,
    gradeLevel,
  });

  const publishedAdventure = adventure
    ? null
    : await ExploreAdventure.findOne({
        schoolId: input.schoolId,
        classGroupId,
        lessonId: session._id,
        status: "teacher_approved",
      }).lean<{
        _id: Types.ObjectId;
        generationKey: string;
        status: string;
        title: string;
        estimatedMinutes?: number;
      } | null>();

  const resolvedAdventure = adventure ?? publishedAdventure;

  const job = resolvedAdventure
    ? await ExploreGenerationJob.findOne({
        schoolId: input.schoolId,
        generationKey: resolvedAdventure.generationKey,
      })
        .sort({ createdAt: -1 })
        .lean<{ status: string } | null>()
    : await ExploreGenerationJob.findOne({
        schoolId: input.schoolId,
        lessonId: session._id,
        classGroupId,
      })
        .sort({ createdAt: -1 })
        .lean<{ status: string } | null>();

  let introPreview: string | null = null;
  if (resolvedAdventure) {
    const loaded = await loadExploreSnapshotForAdventure(resolvedAdventure._id);
    introPreview = loaded?.snapshot.content?.intro?.slice(0, 180) ?? null;
  }

  return serializeStatus({
    sessionId: String(session._id),
    adventure: resolvedAdventure,
    job,
    introPreview,
  });
}

export async function generateTeacherSessionExplore(input: {
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  userId: Types.ObjectId;
  sessionId: Types.ObjectId;
  isAdmin: boolean;
  classGroupId?: string | Types.ObjectId | null;
}) {
  await connectToDatabase();

  const loaded = await loadLessonSessionForTeacher({
    sessionId: input.sessionId,
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    isAdmin: input.isAdmin,
    classGroupId:
      input.classGroupId && Types.ObjectId.isValid(String(input.classGroupId))
        ? new Types.ObjectId(String(input.classGroupId))
        : null,
  });

  if (loaded.kind === "not_found") {
    return { ok: false as const, status: 404, error: "Session not found." };
  }

  if (loaded.kind === "forbidden") {
    return { ok: false as const, status: 403, error: "Forbidden." };
  }

  const { session } = loaded;
  const classGroupId = new Types.ObjectId(loaded.activeClassGroupId);

  if (
    !canManageLessonSessionContent({
      session,
      teacherId: input.teacherId,
      isAdmin: input.isAdmin,
    })
  ) {
    return { ok: false as const, status: 403, error: "Forbidden." };
  }

  if (!session.subjectOfferingId) {
    return {
      ok: false as const,
      status: 400,
      error: "Session must have a class group and subject before Explore can be generated.",
    };
  }

  const gradeLevel = await resolveGradeLevelForClassGroup({
    schoolId: input.schoolId,
    classGroupId,
  });

  const existingPublished = await ExploreAdventure.findOne({
    schoolId: input.schoolId,
    classGroupId,
    lessonId: session._id,
    status: "teacher_approved",
  }).lean();

  if (existingPublished) {
    return {
      ok: true as const,
      data: await getTeacherSessionExploreStatus({
        schoolId: input.schoolId,
        sessionId: session._id,
        classGroupId,
      }),
    };
  }

  const worker = await buildExploreWorkerContextForClass({
    schoolId: input.schoolId,
    classGroupId,
  });

  if (!worker) {
    return {
      ok: false as const,
      status: 400,
      error:
        "No Learn student found in this class yet. Enable Learn accounts for students in this class before Explore can be prepared.",
    };
  }

  const jobResult = await createExploreGenerationJob({
    schoolId: input.schoolId,
    classGroupId,
    subjectOfferingId: session.subjectOfferingId,
    lessonId: session._id,
    gradeLevel,
    mode: "go_deeper",
    requestedByStudentId: worker.studentId,
  });

  if (jobResult.kind === "ready" && jobResult.adventure) {
    await ExploreAdventure.updateOne(
      { _id: jobResult.adventure._id },
      { $set: { createdBy: "teacher" } },
    );
    return {
      ok: true as const,
      data: await getTeacherSessionExploreStatus({
        schoolId: input.schoolId,
        sessionId: session._id,
        classGroupId,
      }),
    };
  }

  if (jobResult.kind !== "job_created" && jobResult.kind !== "generating") {
    return {
      ok: false as const,
      status: 500,
      error: jobResult.kind === "failed" ? jobResult.message : "Could not start Explore generation.",
    };
  }

  const jobId = jobResult.job._id;
  const run = await runExploreGenerationForClaimedJob({
    jobId,
    auth: worker,
  });

  if (run.ok && "adventureId" in run) {
    const adventureOid = run.adventureId.replace(/^adventure-/, "");
    if (Types.ObjectId.isValid(adventureOid)) {
      await ExploreAdventure.updateOne(
        { _id: adventureOid },
        { $set: { createdBy: "teacher" } },
      );
    }
  }

  return {
    ok: true as const,
    data: await getTeacherSessionExploreStatus({
      schoolId: input.schoolId,
      sessionId: session._id,
      classGroupId,
    }),
  };
}

export async function publishTeacherSessionExplore(input: {
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  userId: Types.ObjectId;
  sessionId: Types.ObjectId;
  isAdmin: boolean;
  classGroupId?: string | Types.ObjectId | null;
}) {
  await connectToDatabase();

  const status = await getTeacherSessionExploreStatus({
    schoolId: input.schoolId,
    sessionId: input.sessionId,
    classGroupId: input.classGroupId,
  });

  if (!status?.adventureId) {
    return {
      ok: false as const,
      status: 400,
      error: "Generate an Explore mission before publishing.",
    };
  }

  if (status.status === "published") {
    return { ok: true as const, data: status };
  }

  if (status.status !== "ready_for_review") {
    return {
      ok: false as const,
      status: 400,
      error: "Explore is not ready to publish yet.",
    };
  }

  await applyTeacherExploreAdminReview({
    schoolId: input.schoolId,
    reviewerId: input.userId,
    adventureId: status.adventureId,
    action: "approve",
    notes: "Published from teacher session follow-up.",
  });

  const adventureOid = status.adventureId.replace(/^adventure-/, "");
  if (Types.ObjectId.isValid(adventureOid)) {
    await ExploreAdventure.updateOne(
      { _id: adventureOid },
      { $set: { createdBy: "teacher" } },
    );
  }

  return {
    ok: true as const,
    data: await getTeacherSessionExploreStatus({
      schoolId: input.schoolId,
      sessionId: input.sessionId,
      classGroupId: input.classGroupId,
    }),
  };
}

async function assertTeacherSessionExploreAccess(input: {
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  sessionId: Types.ObjectId;
  isAdmin: boolean;
  classGroupId?: string | Types.ObjectId | null;
  requireWrite?: boolean;
}) {
  const loaded = await loadLessonSessionForTeacher({
    sessionId: input.sessionId,
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    isAdmin: input.isAdmin,
    classGroupId:
      input.classGroupId && Types.ObjectId.isValid(String(input.classGroupId))
        ? new Types.ObjectId(String(input.classGroupId))
        : null,
  });

  if (loaded.kind === "not_found") {
    return { ok: false as const, status: 404, error: "Session not found." };
  }

  if (loaded.kind === "forbidden") {
    return { ok: false as const, status: 403, error: "Forbidden." };
  }

  const canRead = canReadLessonSession({
    session: loaded.session,
    delivery: loaded.delivery,
    teacherId: input.teacherId,
    isAdmin: input.isAdmin,
  });

  if (!canRead) {
    return { ok: false as const, status: 403, error: "Forbidden." };
  }

  if (
    input.requireWrite &&
    !canManageLessonSessionContent({
      session: loaded.session,
      teacherId: input.teacherId,
      isAdmin: input.isAdmin,
    })
  ) {
    return { ok: false as const, status: 403, error: "Forbidden." };
  }

  return {
    ok: true as const,
    classGroupId: new Types.ObjectId(loaded.activeClassGroupId),
  };
}

export async function getTeacherSessionExploreDetailForReview(input: {
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  sessionId: Types.ObjectId;
  isAdmin: boolean;
  classGroupId?: string | Types.ObjectId | null;
}) {
  await connectToDatabase();

  const access = await assertTeacherSessionExploreAccess(input);
  if (!access.ok) return access;

  const status = await getTeacherSessionExploreStatus({
    schoolId: input.schoolId,
    sessionId: input.sessionId,
    classGroupId: access.classGroupId,
  });

  if (!status?.adventureId) {
    return {
      ok: false as const,
      status: 404,
      error: "No Explore mission for this session yet.",
    };
  }

  const detail = await getLazyExploreDetailForAdminQa(input.schoolId, status.adventureId, {
    classGroupIds: [access.classGroupId],
  });

  if (!detail) {
    return {
      ok: false as const,
      status: 404,
      error: "Explore mission not found for this class.",
    };
  }

  return { ok: true as const, data: detail };
}

export async function updateTeacherSessionExploreContent(input: {
  schoolId: Types.ObjectId;
  teacherId: Types.ObjectId;
  sessionId: Types.ObjectId;
  isAdmin: boolean;
  classGroupId?: string | Types.ObjectId | null;
  content: GuidedAdventureContentV2;
}) {
  await connectToDatabase();

  const access = await assertTeacherSessionExploreAccess({
    ...input,
    requireWrite: true,
  });
  if (!access.ok) return access;

  const status = await getTeacherSessionExploreStatus({
    schoolId: input.schoolId,
    sessionId: input.sessionId,
    classGroupId: access.classGroupId,
  });

  if (!status?.adventureId) {
    return {
      ok: false as const,
      status: 404,
      error: "No Explore mission for this session yet.",
    };
  }

  const detail = await updateLazyExploreContentForAdminQa({
    schoolId: input.schoolId,
    adventureId: status.adventureId,
    content: input.content,
    scope: { classGroupIds: [access.classGroupId] },
  });

  if (!detail) {
    return {
      ok: false as const,
      status: 404,
      error: "Explore mission not found for this class.",
    };
  }

  return { ok: true as const, data: detail };
}
