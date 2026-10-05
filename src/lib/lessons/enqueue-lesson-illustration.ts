import "server-only";

import { createHash } from "crypto";
import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { enqueueBackgroundJob } from "@/lib/background/enqueue-job";
import { LessonIllustrationRequest } from "@/models/LessonIllustrationRequest";
import type { TeacherContext } from "@/lib/auth/requireTeacher";

export function illustrationRequestHash(input: {
  prompt?: string;
  fact?: string;
  detail?: string;
  sessionTitle?: string;
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        prompt: input.prompt ?? "",
        fact: input.fact ?? "",
        detail: input.detail ?? "",
        sessionTitle: input.sessionTitle ?? "",
      })
    )
    .digest("hex")
    .slice(0, 24);
}

export async function enqueueLessonIllustration(input: {
  context: TeacherContext;
  prompt?: string;
  fact?: string;
  detail?: string;
  sessionTitle?: string;
  regenerate?: boolean;
}) {
  await connectToDatabase();
  const hash = illustrationRequestHash(input);
  const latest = input.regenerate
    ? await LessonIllustrationRequest.findOne({
        schoolId: input.context.schoolId,
        teacherUserId: input.context.userId,
        prompt: input.prompt ?? null,
        fact: input.fact ?? null,
        detail: input.detail ?? null,
      })
        .sort({ revision: -1 })
        .select("revision")
        .lean<{ revision?: number } | null>()
    : null;
  const revision = (latest?.revision ?? 0) + 1;
  const idempotencyKey = `ai-illustration:${String(input.context.schoolId)}:${String(input.context.userId)}:${hash}:${revision}`;

  let request = await LessonIllustrationRequest.findOne({
    schoolId: input.context.schoolId,
    idempotencyKey,
  });
  if (!request) {
    request = await LessonIllustrationRequest.create({
      schoolId: input.context.schoolId,
      teacherUserId: input.context.userId,
      teacherId: input.context.teacherId,
      revision,
      idempotencyKey,
      status: "queued",
      prompt: input.prompt ?? null,
      fact: input.fact ?? null,
      detail: input.detail ?? null,
      sessionTitle: input.sessionTitle ?? null,
    });
  }

  const queued = await enqueueBackgroundJob({
    kind: "AI_LESSON_ILLUSTRATION",
    schoolId: input.context.schoolId,
    initiatedByUserId: input.context.userId,
    notificationTargetUserId: input.context.userId,
    subjectType: "LessonIllustrationRequest",
    subjectId: request._id,
    correlationId: String(request._id),
    idempotencyKey,
    input: { illustrationRequestId: String(request._id) },
  });

  request.backgroundJobId = new mongoose.Types.ObjectId(queued.jobId);
  await request.save();

  return {
    jobId: queued.jobId,
    illustrationRequestId: String(request._id),
    status: queued.job.status,
  };
}
