import { NextRequest } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { assertTeacherImportId } from "@/lib/teachers/teacher-import-route";
import { assessTeacherAttention } from "@/lib/teachers/teacher-attention-assessment";
import { TeacherImportJob } from "@/models/TeacherImportJob";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSchoolAdmin();
    await connectToDatabase();
    const objectId = assertTeacherImportId((await ctx.params).id);
    if (!objectId) return Response.json({ success: false, error: "Invalid teacher import id" }, { status: 400 });
    const body = await req.json() as { issueId?: string };
    const job = await TeacherImportJob.findOne({ _id: objectId, schoolId: actor.schoolId, status: "review_ready" });
    if (!job) return Response.json({ success: false, error: "Teacher import review not found" }, { status: 404 });
    const issue = (job.analysisIssues || []).find((candidate) => candidate.issueId === String(body.issueId || "") && candidate.status === "open" && candidate.issueType.startsWith("attention_"));
    if (!issue) return Response.json({ success: false, error: "That attention item is no longer active." }, { status: 409 });
    const subjectLabelsById = new Map<string, string>();
    for (const resolution of job.subjectResolutions || []) {
      (resolution.subjectOfferingIds || []).forEach((id, index) => subjectLabelsById.set(String(id), resolution.resolvedNames?.[index] || resolution.sourceValue));
    }
    const assessment = await assessTeacherAttention({ job, issue, schoolId: actor.schoolId, subjectLabelsById });
    await job.save();
    return Response.json({ success: true, data: assessment });
  } catch (error) {
    return Response.json({ success: false, error: error instanceof Error ? error.message : "Leo could not assess this attention item." }, { status: 400 });
  }
}
