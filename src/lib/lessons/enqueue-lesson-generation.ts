import "server-only";

import mongoose from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { enqueueBackgroundJob } from "@/lib/background/enqueue-job";
import {
  LessonAiGenerationRequest,
  type ILessonAiGenerationRequest,
  type LessonAiGenerationTargetKind,
  type LessonAiSlotSnapshot,
} from "@/models/LessonAiGenerationRequest";
import { LessonNote } from "@/models/LessonNote";
import { LessonSession } from "@/models/LessonSession";
import type { TeacherContext } from "@/lib/auth/requireTeacher";
import { findLessonNoteForTeacher } from "@/lib/leo/lessons-draft-shared";

function formatWeekStart(value?: string | Date | null): string {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export function lessonGenerationIdempotencyKey(input: {
  targetKind: LessonAiGenerationTargetKind;
  schoolId: string;
  teacherUserId: string;
  lessonNoteId: string;
  sessionId?: string | null;
  classGroupId?: string | null;
  weekStartDate?: string | null;
  slotDraftId?: string | null;
  revision: number;
}): string {
  if (input.targetKind === "existing_session" && input.sessionId) {
    return `ai-lesson:session:${input.schoolId}:${input.sessionId}:${input.revision}`;
  }
  if (input.targetKind === "week_batch") {
    return `ai-lesson:week:${input.schoolId}:${input.teacherUserId}:${input.lessonNoteId}:${input.classGroupId ?? "none"}:${formatWeekStart(input.weekStartDate)}:${input.revision}`;
  }
  return `ai-lesson:week-slot:${input.schoolId}:${input.teacherUserId}:${input.lessonNoteId}:${input.slotDraftId ?? "slot"}:${input.revision}`;
}

export function lessonGenerationActionUrl(request: ILessonAiGenerationRequest): string {
  if (request.sessionId) {
    return `/teacher/lessons/sessions/${String(request.sessionId)}`;
  }
  const params = new URLSearchParams({
    noteId: String(request.lessonNoteId),
    generationRequestId: String(request._id),
  });
  if (request.classGroupId) params.set("classGroupId", String(request.classGroupId));
  return `/teacher/lessons/create?${params.toString()}`;
}

async function nextRevision(input: {
  schoolId: mongoose.Types.ObjectId;
  targetKind: LessonAiGenerationTargetKind;
  sessionId?: mongoose.Types.ObjectId | null;
  teacherUserId: mongoose.Types.ObjectId;
  lessonNoteId: mongoose.Types.ObjectId;
  classGroupId?: mongoose.Types.ObjectId | null;
  weekStartDate?: string | null;
  slotDraftId?: string | null;
}): Promise<number> {
  const filter: Record<string, unknown> = {
    schoolId: input.schoolId,
    targetKind: input.targetKind,
    lessonNoteId: input.lessonNoteId,
  };
  if (input.sessionId) filter.sessionId = input.sessionId;
  else {
    filter.teacherUserId = input.teacherUserId;
    if (input.classGroupId) filter.classGroupId = input.classGroupId;
    if (input.weekStartDate) filter.weekStartDate = formatWeekStart(input.weekStartDate);
  }
  const latest = await LessonAiGenerationRequest.findOne(filter)
    .sort({ revision: -1 })
    .select("revision")
    .lean<{ revision?: number } | null>();
  return (latest?.revision ?? 0) + 1;
}

export async function enqueueLessonAiGeneration(input: {
  context: TeacherContext;
  lessonNoteId: string;
  targetKind: LessonAiGenerationTargetKind;
  slots: LessonAiSlotSnapshot[];
  sessionId?: string | null;
  classGroupId?: string | null;
  weekStartDate?: string | null;
  regenerate?: boolean;
}): Promise<
  | {
      ok: true;
      jobId: string;
      generationRequestId: string;
      created: boolean;
      status: string;
    }
  | { ok: false; error: string; status: number }
> {
  await connectToDatabase();
  const note = await findLessonNoteForTeacher(
    input.lessonNoteId,
    input.context.schoolId,
    input.context.teacherId
  );
  if (!note) {
    return { ok: false, error: "Lesson note not found", status: 404 };
  }

  let sessionOid: mongoose.Types.ObjectId | null = null;
  if (input.sessionId) {
    if (!mongoose.Types.ObjectId.isValid(input.sessionId)) {
      return { ok: false, error: "Invalid session", status: 400 };
    }
    sessionOid = new mongoose.Types.ObjectId(input.sessionId);
    const session = await LessonSession.findOne({
      _id: sessionOid,
      schoolId: input.context.schoolId,
    })
      .select("_id")
      .lean();
    if (!session) {
      return { ok: false, error: "Lesson session not found", status: 404 };
    }
  }

  const classGroupId =
    input.classGroupId && mongoose.Types.ObjectId.isValid(input.classGroupId)
      ? new mongoose.Types.ObjectId(input.classGroupId)
      : note.classGroupId
        ? new mongoose.Types.ObjectId(String(note.classGroupId))
        : null;

  const revision = input.regenerate
    ? await nextRevision({
        schoolId: input.context.schoolId,
        targetKind: input.targetKind,
        sessionId: sessionOid,
        teacherUserId: input.context.userId,
        lessonNoteId: note._id,
        classGroupId,
        weekStartDate: input.weekStartDate,
        slotDraftId: input.slots[0]?.slotDraftId,
      })
    : 1;

  const idempotencyKey = lessonGenerationIdempotencyKey({
    targetKind: input.targetKind,
    schoolId: String(input.context.schoolId),
    teacherUserId: String(input.context.userId),
    lessonNoteId: String(note._id),
    sessionId: sessionOid ? String(sessionOid) : null,
    classGroupId: classGroupId ? String(classGroupId) : null,
    weekStartDate: input.weekStartDate,
    slotDraftId: input.slots[0]?.slotDraftId,
    revision,
  });

  const existing = await LessonAiGenerationRequest.findOne({
    schoolId: input.context.schoolId,
    idempotencyKey,
  });

  let request = existing;
  if (!request) {
    request = await LessonAiGenerationRequest.create({
      schoolId: input.context.schoolId,
      teacherUserId: input.context.userId,
      teacherId: input.context.teacherId,
      lessonNoteId: note._id,
      targetKind: input.targetKind,
      sessionId: sessionOid,
      classGroupId,
      weekStartDate: formatWeekStart(input.weekStartDate) || null,
      revision,
      idempotencyKey,
      status: "queued",
      noteUpdatedAt: note.updatedAt ?? null,
      slots: input.slots,
      slotResults: input.slots.map((slot) => ({
        slotDraftId: slot.slotDraftId,
        status: "pending",
      })),
      providerCheckpoints: [],
    });
  }

  const queued = await enqueueBackgroundJob({
    kind: "AI_LESSON_GENERATION",
    schoolId: input.context.schoolId,
    initiatedByUserId: input.context.userId,
    notificationTargetUserId: input.context.userId,
    subjectType: "LessonAiGenerationRequest",
    subjectId: request._id,
    correlationId: String(request._id),
    idempotencyKey,
    input: { generationRequestId: String(request._id) },
  });

  request.backgroundJobId = new mongoose.Types.ObjectId(queued.jobId);
  await request.save();

  return {
    ok: true,
    jobId: queued.jobId,
    generationRequestId: String(request._id),
    created: queued.created,
    status: queued.job.status,
  };
}

export async function loadLessonNoteUpdatedAt(noteId: mongoose.Types.ObjectId) {
  const note = await LessonNote.findById(noteId).select("updatedAt").lean<{ updatedAt?: Date } | null>();
  return note?.updatedAt ?? null;
}
