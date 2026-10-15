import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdminOrDelegatedAnyPermission } from "@/lib/delegations/requireDelegatedModulePermission";
import { enqueueBackgroundJob } from "@/lib/background/enqueue-job";
import { StudentImportJob } from "@/models/StudentImportJob";
import { assertStudentImportId } from "@/lib/students/student-import-route";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSchoolAdminOrDelegatedAnyPermission(["students.edit"]);
    await connectToDatabase();
    const id = assertStudentImportId((await context.params).id);
    if (!id) return Response.json({ success: false, error: "Invalid student import id" }, { status: 400 });
    const job = await StudentImportJob.findOne({ _id: id, schoolId: actor.schoolId });
    if (!job) return Response.json({ success: false, error: "Student import not found" }, { status: 404 });
    if (!job.fileBytes?.length) return Response.json({ success: false, error: "The original upload is no longer available." }, { status: 409 });
    if (!["review_ready", "failed"].includes(job.status)) return Response.json({ success: false, error: "Leo can only be retried before confirmation." }, { status: 409 });
    job.status = "uploaded";
    job.analysisErrors = [];
    job.analysisWarnings = job.analysisWarnings.filter((item) => item.code !== "leo_unavailable");
    await job.save();
    const queued = await enqueueBackgroundJob({ kind: "BULK_IMPORT", schoolId: actor.schoolId, initiatedByUserId: actor.userId, notificationTargetUserId: actor.userId, subjectType: "StudentImportJob", subjectId: job._id, idempotencyKey: `student-import-leo-retry:${actor.schoolId}:${job._id}:${Date.now()}`, input: { studentImportJobId: String(job._id), studentImportPhase: "analysis" } });
    job.analysisBackgroundJobId = queued.job._id;
    await job.save();
    return Response.json({ success: true, data: { id: String(job._id), status: job.status, backgroundJobId: queued.jobId } });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Could not retry Leo analysis" }, { status: 400 });
  }
}
