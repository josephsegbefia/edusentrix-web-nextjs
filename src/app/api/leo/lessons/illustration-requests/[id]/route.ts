import mongoose from "mongoose";
import { requireLessonsLeoTeacherContext } from "@/lib/leo/lessons-draft-shared";
import { connectToDatabase } from "@/db/connectToDatabase";
import { LessonIllustrationRequest } from "@/models/LessonIllustrationRequest";
import { BackgroundJob } from "@/models/BackgroundJob";
import { toSafeBackgroundJobDTO } from "@/lib/background/serializers";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const ctx = await requireLessonsLeoTeacherContext();
    if (ctx instanceof Response) return ctx;
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return Response.json({ success: false, error: "Invalid illustration request" }, { status: 400 });
    }
    await connectToDatabase();
    const request = await LessonIllustrationRequest.findOne({
      _id: id,
      schoolId: ctx.schoolId,
      teacherUserId: ctx.userId,
    }).lean();
    if (!request) {
      return Response.json({ success: false, error: "Illustration request not found" }, { status: 404 });
    }
    const job = request.backgroundJobId
      ? await BackgroundJob.findById(request.backgroundJobId)
      : null;
    return Response.json({
      success: true,
      data: {
        id: String(request._id),
        status: request.status,
        imageUrl: request.imageUrl ?? null,
        uploadThingKey: request.storageKey ?? null,
        generationPrompt: request.generationPrompt ?? null,
        lastError: request.lastError ?? null,
        job: job ? toSafeBackgroundJobDTO(job) : null,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: "Failed to load illustration" }, { status: 500 });
  }
}
