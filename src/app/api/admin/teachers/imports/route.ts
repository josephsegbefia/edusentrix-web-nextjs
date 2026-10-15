import { connectToDatabase } from "@/db/connectToDatabase";
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { TeacherImportJob } from "@/models/TeacherImportJob";
import { serializeTeacherImportJob } from "@/lib/teachers/teacher-import-workflow";
import { assertTeacherImportId } from "@/lib/teachers/teacher-import-route";
import type { ITeacherImportJob } from "@/models/TeacherImportJob";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireSchoolAdmin();
    await connectToDatabase();
    const activeOnly = req.nextUrl.searchParams.get("active") === "1";
    const jobs = await TeacherImportJob.find({
      schoolId: ctx.schoolId,
      ...(activeOnly ? { status: { $in: ["uploaded", "analyzing", "review_ready", "failed"] } } : {}),
    }).sort({ updatedAt: -1 }).limit(activeOnly ? 1 : 50).lean();
    return Response.json({ success: true, data: jobs.map((job) => serializeTeacherImportJob(job as unknown as ITeacherImportJob)) });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to load teacher imports" }, { status: 500 });
  }
}
