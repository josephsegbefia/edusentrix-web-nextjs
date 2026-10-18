import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { buildSchoolUserAuditContext } from "@/lib/audit/fromApiRoute";
import { AssessmentMarkingError, submitMarkingEvaluation } from "@/lib/assess/assessment-marking-service";

export async function POST(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const teacher = await requireTeacher();
    const premium = await requireAssessPremiumPublication(teacher.schoolId);
    if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode });
    const { assignmentId } = await params;
    if (!Types.ObjectId.isValid(assignmentId)) return Response.json({ success: false, error: "Invalid marking assignment id" }, { status: 400 });
    const idempotencyKey = request.headers.get("x-idempotency-key")?.trim();
    if (!idempotencyKey) return Response.json({ success: false, error: "x-idempotency-key is required" }, { status: 400 });
    await connectToDatabase();
    const result = await submitMarkingEvaluation({ actor: { userId: teacher.userId, schoolId: teacher.schoolId, teacherId: teacher.teacherId, isAdmin: teacher.isAdmin, premiumPublicationEntitled: true }, markingAssignmentId: new Types.ObjectId(assignmentId), idempotencyKey, auditContext: buildSchoolUserAuditContext(request, { userId: teacher.userId, schoolId: teacher.schoolId, actorRole: "teacher", idempotencyKey }) });
    return Response.json({ success: true, replayed: result.replayed, data: { id: String(result.evaluation._id), status: result.evaluation.status, revisionNumber: result.revision.revisionNumber, totalMarks: result.evaluation.totalMarks } });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof AssessmentMarkingError) return Response.json({ success: false, error: error.message }, { status: error.status });
    return Response.json({ success: false, error: "Failed to submit marking evaluation" }, { status: 500 });
  }
}
