import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { enqueueBackgroundJob } from "@/lib/background/enqueue-job";
import { TeacherImportJob } from "@/models/TeacherImportJob";
import { assertTeacherImportId } from "@/lib/teachers/teacher-import-route";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSchoolAdmin();
    await connectToDatabase();
    const id = assertTeacherImportId((await context.params).id);
    if (!id) return Response.json({ success: false, error: "Invalid teacher import id" }, { status: 400 });
    const job = await TeacherImportJob.findOne({ _id: id, schoolId: actor.schoolId });
    if (!job) return Response.json({ success: false, error: "Teacher import not found" }, { status: 404 });
    if (!job.fileBytes?.length) return Response.json({ success: false, error: "The original upload is no longer available." }, { status: 409 });
    if (!["review_ready", "failed"].includes(job.status)) return Response.json({ success: false, error: "Leo can only be retried before confirmation." }, { status: 409 });
    job.status = "uploaded";
    job.analysisErrors = [];
    job.analysisWarnings = job.analysisWarnings.filter((item) => item.code !== "leo_unavailable");
    await job.save();
    const queued = await enqueueBackgroundJob({ kind: "BULK_IMPORT", schoolId: actor.schoolId, initiatedByUserId: actor.userId, notificationTargetUserId: actor.userId, subjectType: "TeacherImportJob", subjectId: job._id, idempotencyKey: `teacher-import-leo-retry:${actor.schoolId}:${job._id}:${Date.now()}`, input: { teacherImportJobId: String(job._id), teacherImportPhase: "analysis" } });
    job.analysisBackgroundJobId = queued.job._id;
    await job.save();
    return Response.json({ success: true, data: { id: String(job._id), status: job.status, backgroundJobId: queued.jobId } });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Could not retry Leo analysis" }, { status: 400 });
  }
}
