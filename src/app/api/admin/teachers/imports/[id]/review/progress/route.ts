import { NextRequest } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { assertTeacherImportId } from "@/lib/teachers/teacher-import-route";
import { TeacherImportJob } from "@/models/TeacherImportJob";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSchoolAdmin(); await connectToDatabase();
    const objectId = assertTeacherImportId((await ctx.params).id);
    if (!objectId) return Response.json({ success: false, error: "Invalid teacher import id" }, { status: 400 });
    const body = await req.json() as { lastRowRef?: string | null };
    const job = await TeacherImportJob.findOne({ _id: objectId, schoolId: actor.schoolId, status: "review_ready" });
    if (!job) return Response.json({ success: false, error: "Teacher import review not found" }, { status: 404 });
    job.attentionReview = job.attentionReview || { assessments: [], similarityGroups: [], lastRowRef: null, updatedAt: null };
    job.attentionReview.lastRowRef = typeof body.lastRowRef === "string" ? body.lastRowRef : null;
    job.attentionReview.updatedAt = new Date();
    await job.save();
    return Response.json({ success: true });
  } catch (error) { return Response.json({ success: false, error: error instanceof Error ? error.message : "Could not save review progress." }, { status: 400 }); }
}
