import { NextRequest } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { assertTeacherImportId } from "@/lib/teachers/teacher-import-route";
import { confirmTeacherImportReviewInstruction } from "@/lib/teachers/teacher-import-review-nl";
import { TeacherImportJob } from "@/models/TeacherImportJob";
import { buildTeacherImportReviewDto } from "@/lib/teachers/teacher-import-review-dto";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSchoolAdmin(); await connectToDatabase();
    const objectId = assertTeacherImportId((await ctx.params).id);
    if (!objectId) return Response.json({ success: false, error: "Invalid teacher import id" }, { status: 400 });
    const body = await req.json() as { instructionId?: string };
    const job = await TeacherImportJob.findOne({ _id: objectId, schoolId: actor.schoolId, status: "review_ready" });
    if (!job) return Response.json({ success: false, error: "Teacher import review not found" }, { status: 404 });
    const resolution = await confirmTeacherImportReviewInstruction({ job, instructionId: String(body.instructionId || ""), confirmedBy: String(actor.userId) });
    await job.save();
    return Response.json({ success: true, data: { resolution, review: buildTeacherImportReviewDto(job) } });
  } catch (error) { return Response.json({ success: false, error: error instanceof Error ? error.message : "Could not confirm Leo's interpretation." }, { status: 400 }); }
}
