import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { TeacherImportJob } from "@/models/TeacherImportJob";
import { assertTeacherImportId } from "@/lib/teachers/teacher-import-route";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSchoolAdmin();
    await connectToDatabase();
    const { id } = await ctx.params;
    const objectId = assertTeacherImportId(id);
    if (!objectId) return Response.json({ success: false, error: "Invalid teacher import id" }, { status: 400 });
    const job = await TeacherImportJob.findOne({ _id: objectId, schoolId: actor.schoolId });
    if (!job) return Response.json({ success: false, error: "Teacher import not found" }, { status: 404 });
    if (["committing", "completed", "completed_with_errors"].includes(job.status)) {
      return Response.json({ success: false, error: "This import can no longer be cancelled safely." }, { status: 409 });
    }
    job.status = "cancelled";
    await job.save();
    return Response.json({ success: true, data: { id: String(job._id), status: job.status } });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to cancel teacher import" }, { status: 500 });
  }
}
