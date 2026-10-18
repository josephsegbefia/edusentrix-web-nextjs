import { Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { buildSchoolUserAuditContext } from "@/lib/audit/fromApiRoute";
import { AssessmentMarkingError, saveMarkingDraft } from "@/lib/assess/assessment-marking-service";

const scoreSchema = z.object({ questionId: z.string().trim().min(1).max(160), score: z.number().nullable().optional(), feedback: z.string().max(4000).nullable().optional() });
const schema = z.object({ expectedDraftVersion: z.number().int().min(0), questionScores: z.array(scoreSchema).max(500) });

export async function PUT(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const teacher = await requireTeacher();
    const premium = await requireAssessPremiumPublication(teacher.schoolId);
    if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode });
    const { assignmentId } = await params;
    if (!Types.ObjectId.isValid(assignmentId)) return Response.json({ success: false, error: "Invalid marking assignment id" }, { status: 400 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ success: false, error: "Invalid marking draft" }, { status: 400 });
    await connectToDatabase();
    const result = await saveMarkingDraft({ actor: { userId: teacher.userId, schoolId: teacher.schoolId, teacherId: teacher.teacherId, isAdmin: teacher.isAdmin, premiumPublicationEntitled: true }, markingAssignmentId: new Types.ObjectId(assignmentId), expectedDraftVersion: parsed.data.expectedDraftVersion, questionScores: parsed.data.questionScores, auditContext: buildSchoolUserAuditContext(request, { userId: teacher.userId, schoolId: teacher.schoolId, actorRole: "teacher", idempotencyKey: `draft:${assignmentId}:${parsed.data.expectedDraftVersion}` }) });
    return Response.json({ success: true, data: { id: String(result.evaluation._id), status: result.evaluation.status, draftVersion: result.evaluation.draftVersion, totalMarks: result.evaluation.totalMarks, unmarkedQuestionCount: result.evaluation.unmarkedQuestionCount } });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof AssessmentMarkingError) return Response.json({ success: false, error: error.message }, { status: error.status });
    return Response.json({ success: false, error: "Failed to save marking draft" }, { status: 500 });
  }
}
