import { NextRequest } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { TeacherImportJob } from "@/models/TeacherImportJob";
import { applyTeacherImportReview, type TeacherImportReviewInput } from "@/lib/teachers/teacher-import-review";
import { serializeTeacherImportJob } from "@/lib/teachers/teacher-import-workflow";
import { assertTeacherImportId } from "@/lib/teachers/teacher-import-route";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSchoolAdmin();
    await connectToDatabase();
    const { id } = await ctx.params;
    const objectId = assertTeacherImportId(id);
    if (!objectId) return Response.json({ success: false, error: "Invalid teacher import id" }, { status: 400 });
    const job = await TeacherImportJob.findOne({ _id: objectId, schoolId: actor.schoolId });
    if (!job) return Response.json({ success: false, error: "Teacher import not found" }, { status: 404 });
    return Response.json({ success: true, data: serializeTeacherImportJob(job) });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to load teacher import" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSchoolAdmin();
    await connectToDatabase();
    const { id } = await ctx.params;
    const objectId = assertTeacherImportId(id);
    if (!objectId) return Response.json({ success: false, error: "Invalid teacher import id" }, { status: 400 });
    const job = await TeacherImportJob.findOne({ _id: objectId, schoolId: actor.schoolId });
    if (!job) return Response.json({ success: false, error: "Teacher import not found" }, { status: 404 });
    if (job.status !== "review_ready") return Response.json({ success: false, error: "Only an import waiting for review can be edited." }, { status: 409 });
    const input = (await req.json()) as TeacherImportReviewInput;
    await applyTeacherImportReview(job, { ...input, rows: undefined });
    if (input.rows?.length) await applyTeacherImportReview(job, { rows: input.rows });
    await job.save();
    return Response.json({ success: true, data: serializeTeacherImportJob(job) });
  } catch (error) {
    if (error instanceof Response) return error;
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Failed to save teacher import review" }, { status: 400 });
  }
}
