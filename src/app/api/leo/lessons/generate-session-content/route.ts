import { z } from "zod";
import { requireLessonsLeoTeacherContext } from "@/lib/leo/lessons-draft-shared";
import { enqueueLessonAiGeneration } from "@/lib/lessons/enqueue-lesson-generation";
import type { LessonAiSlotSnapshot } from "@/models/LessonAiGenerationRequest";

const PriorSessionSchema = z.object({
  title: z.string().trim().min(1).max(220),
  focusSummary: z.string().trim().max(500).optional(),
  keyPointsSummary: z.string().trim().max(1200).optional(),
});

const SessionSchema = z.object({
  title: z.string().trim().min(1).max(220),
  durationMinutes: z.number().int().min(1).max(240),
  noteSectionKeys: z.array(z.string().min(1)).default([]),
  coverageWeight: z.number().min(0).max(1).optional(),
  scheduledDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  periodCount: z.number().int().min(1).max(8).optional(),
  isDoublePeriod: z.boolean().optional(),
  focusSummary: z.string().trim().max(500).optional(),
  sequenceInWeek: z.number().int().min(1).max(12).optional(),
  previousSession: PriorSessionSchema.optional(),
  priorSessions: z.array(PriorSessionSchema).max(11).optional(),
  slotDraftId: z.string().trim().min(1).max(120).optional(),
});

const BodySchema = z
  .object({
    lessonNoteId: z.string().min(1),
    sessionId: z.string().optional(),
    session: SessionSchema.optional(),
    weekBatch: z
      .object({
        classGroupId: z.string().min(1),
        weekStartDate: z.string().optional(),
        slots: z.array(SessionSchema).min(1).max(12),
      })
      .optional(),
    regenerate: z.boolean().optional(),
  })
  .refine((data) => Boolean(data.session || data.weekBatch), {
    message: "Provide session or weekBatch",
  });

function toSlot(session: z.infer<typeof SessionSchema>, index: number): LessonAiSlotSnapshot {
  return {
    slotDraftId: session.slotDraftId ?? `slot-${index + 1}`,
    title: session.title,
    durationMinutes: session.durationMinutes,
    noteSectionKeys: session.noteSectionKeys,
    coverageWeight: session.coverageWeight,
    scheduledDate: session.scheduledDate,
    startTime: session.startTime,
    endTime: session.endTime,
    periodCount: session.periodCount,
    isDoublePeriod: session.isDoublePeriod,
    focusSummary: session.focusSummary,
    sequenceInWeek: session.sequenceInWeek ?? index + 1,
    previousSession: session.previousSession,
    priorSessions: session.priorSessions,
  };
}

export async function POST(req: Request) {
  try {
    const ctx = await requireLessonsLeoTeacherContext();
    if (ctx instanceof Response) return ctx;

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((issue) => issue.message).join(", ") || "Invalid body";
      return Response.json({ success: false, error: msg }, { status: 400 });
    }

    const weekBatch = parsed.data.weekBatch;
    const slots = weekBatch
      ? weekBatch.slots.map((session, index) => toSlot(session, index))
      : [toSlot(parsed.data.session!, 0)];

    const result = await enqueueLessonAiGeneration({
      context: ctx,
      lessonNoteId: parsed.data.lessonNoteId,
      targetKind: weekBatch
        ? "week_batch"
        : parsed.data.sessionId
          ? "existing_session"
          : "week_slot",
      slots,
      sessionId: parsed.data.sessionId,
      classGroupId: weekBatch?.classGroupId,
      weekStartDate: weekBatch?.weekStartDate,
      regenerate: parsed.data.regenerate,
    });

    if (!result.ok) {
      return Response.json({ success: false, error: result.error }, { status: result.status });
    }

    return Response.json(
      {
        success: true,
        accepted: true,
        data: {
          jobId: result.jobId,
          generationRequestId: result.generationRequestId,
          status: result.status,
        },
      },
      { status: 202 }
    );
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("[leo/lessons/generate-session-content]", error);
    const message = error instanceof Error ? error.message : "Leo request failed";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
