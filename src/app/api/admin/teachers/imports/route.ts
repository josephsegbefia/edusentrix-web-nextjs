import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { TeacherImportJob } from "@/models/TeacherImportJob";
import { serializeTeacherImportJob } from "@/lib/teachers/teacher-import-workflow";
import { assertTeacherImportId } from "@/lib/teachers/teacher-import-route";
import type { ITeacherImportJob } from "@/models/TeacherImportJob";

export async function GET() {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();
    const jobs = await TeacherImportJob.find({ schoolId: ctx.schoolId }).sort({ createdAt: -1 }).limit(50).lean();
    return Response.json({ success: true, data: jobs.map((job) => serializeTeacherImportJob(job as unknown as ITeacherImportJob)) });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to load teacher imports" }, { status: 500 });
  }
}
