import { NextRequest } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { assertTeacherImportId } from "@/lib/teachers/teacher-import-route";
import { findSimilarAttentionRows } from "@/lib/teachers/teacher-attention-similarity";
import { previewTeacherAttentionSimilar } from "@/lib/teachers/apply-teacher-attention-similar";
import { TeacherImportJob } from "@/models/TeacherImportJob";
import { buildTeacherImportReviewDto } from "@/lib/teachers/teacher-import-review-dto";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSchoolAdmin(); await connectToDatabase();
    const objectId = assertTeacherImportId((await ctx.params).id);
    if (!objectId) return Response.json({ success: false, error: "Invalid teacher import id" }, { status: 400 });
    const params = new URL(req.url).searchParams;
    const issueId = params.get("issueId") || "";
    const proposalId = params.get("proposalId") || "";
    const job = await TeacherImportJob.findOne({ _id: objectId, schoolId: actor.schoolId, status: "review_ready" }).lean();
    if (!job) return Response.json({ success: false, error: "Teacher import review not found" }, { status: 404 });
    const plan = proposalId ? (job.relationshipPlans || []).find((candidate) => String(candidate.proposalId) === proposalId && String(candidate.status) === "confirmed") : null;
    if (plan) {
      const preview = previewTeacherAttentionSimilar(job as unknown as import("@/models/TeacherImportJob").ITeacherImportJob, plan);
      return Response.json({ success: true, data: { count: preview.rows.length, teachers: preview.rows, groupId: preview.groupId, template: preview.template, version: preview.version } });
    }
    const issue = (job.analysisIssues || []).find((candidate) => candidate.issueId === issueId && candidate.status === "open");
    if (!issue) return Response.json({ success: false, error: "That attention item is no longer active." }, { status: 409 });
    const rows = findSimilarAttentionRows(job as unknown as import("@/models/TeacherImportJob").ITeacherImportJob, issue).map((row) => ({ rowRef: row.rowRef || `T${String(row.sourceRowNumber).padStart(3, "0")}`, name: [row.firstName, ...row.middleNames, row.lastName].filter(Boolean).join(" ") || "Imported teacher", homeroom: [row.homeroomGrade, row.homeroomClass].filter(Boolean).join(" ") || null, subjectCount: row.subjectOfferingIds.length || row.subjects.length, signal: issue.sourceValues[0] || issue.issueType }));
    return Response.json({ success: true, data: { count: rows.length, teachers: rows, groupId: null, template: null, version: job.updatedAt?.toISOString?.() || String(job.updatedAt || "") } });
  } catch (error) { return Response.json({ success: false, error: error instanceof Error ? error.message : "Could not preview similar teachers." }, { status: 400 }); }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSchoolAdmin(); await connectToDatabase();
    const objectId = assertTeacherImportId((await ctx.params).id);
    if (!objectId) return Response.json({ success: false, error: "Invalid teacher import id" }, { status: 400 });
    const body = await req.json() as { proposalId?: string; groupId?: string; expectedUpdatedAt?: string };
    const job = await TeacherImportJob.findOne({ _id: objectId, schoolId: actor.schoolId, status: "review_ready" });
    if (!job) return Response.json({ success: false, error: "Teacher import review not found" }, { status: 404 });
    const plan = (job.relationshipPlans || []).find((candidate) => String(candidate.proposalId) === String(body.proposalId) && String(candidate.status) === "confirmed");
    if (!plan) return Response.json({ success: false, error: "The confirmed representative decision is no longer available." }, { status: 409 });
    if (body.groupId && body.groupId !== `similar_${String(plan.proposalId || plan.issueId)}`) return Response.json({ success: false, error: "That similarity group is no longer available." }, { status: 409 });
    const result = await (await import("@/lib/teachers/apply-teacher-attention-similar")).applyTeacherAttentionSimilar({ job, plan, expectedUpdatedAt: String(body.expectedUpdatedAt || ""), confirmedBy: String(actor.userId) });
    await job.save();
    return Response.json({ success: true, data: { ...result, review: buildTeacherImportReviewDto(job) } });
  } catch (error) { return Response.json({ success: false, error: error instanceof Error ? error.message : "Could not apply this interpretation to similar teachers." }, { status: 409 }); }
}
