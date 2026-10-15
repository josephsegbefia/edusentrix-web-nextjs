import { NextRequest } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { assertTeacherImportId } from "@/lib/teachers/teacher-import-route";
import { buildTeacherImportReviewDto } from "@/lib/teachers/teacher-import-review-dto";
import { TeacherImportJob } from "@/models/TeacherImportJob";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSchoolAdmin();
    await connectToDatabase();
    const objectId = assertTeacherImportId((await ctx.params).id);
    if (!objectId) return Response.json({ success: false, error: "Invalid teacher import id" }, { status: 400 });
    const job = await TeacherImportJob.findOne({ _id: objectId, schoolId: actor.schoolId }).lean();
    if (!job) return Response.json({ success: false, error: "Teacher import not found" }, { status: 404 });
    return Response.json({ success: true, data: buildTeacherImportReviewDto(job) });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: "Unable to load the teacher import review." }, { status: 500 });
  }
}
