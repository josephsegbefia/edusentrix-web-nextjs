import mongoose from "mongoose";
import { requireLessonsLeoTeacherContext } from "@/lib/leo/lessons-draft-shared";
import { connectToDatabase } from "@/db/connectToDatabase";
import { LessonAiGenerationRequest } from "@/models/LessonAiGenerationRequest";
import { BackgroundJob } from "@/models/BackgroundJob";
import { toSafeBackgroundJobDTO } from "@/lib/background/serializers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await requireLessonsLeoTeacherContext();
    if (ctx instanceof Response) return ctx;

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid generation request" }, { status: 400 });
    }

    await connectToDatabase();
    const request = await LessonAiGenerationRequest.findOne({
      _id: id,
      schoolId: ctx.schoolId,
      teacherUserId: ctx.userId,
    }).lean();

    if (!request) {
      return Response.json({ success: false, error: "Generation request not found" }, { status: 404 });
    }

    const job = request.backgroundJobId
      ? await BackgroundJob.findById(request.backgroundJobId)
      : null;

    return Response.json({
      success: true,
      data: {
        id: String(request._id),
        targetKind: request.targetKind,
        status: request.status,
        lessonNoteId: String(request.lessonNoteId),
        sessionId: request.sessionId ? String(request.sessionId) : null,
        classGroupId: request.classGroupId ? String(request.classGroupId) : null,
        weekStartDate: request.weekStartDate ?? null,
        revision: request.revision,
        job: job ? toSafeBackgroundJobDTO(job) : null,
        slots: (request.slots ?? []).map((slot, index) => {
          const result = request.slotResults?.find((row) => row.slotDraftId === slot.slotDraftId);
          return {
            slotDraftId: slot.slotDraftId,
            title: slot.title,
            sequenceInWeek: slot.sequenceInWeek ?? index + 1,
            status: result?.status ?? "pending",
            contentBlocks: result?.contentBlocks ?? [],
            error: result?.error ?? null,
          };
        }),
        lastError: request.lastError ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[leo/lessons/generation-requests]", error);
    return Response.json({ success: false, error: "Failed to load generation request" }, { status: 500 });
  }
}
