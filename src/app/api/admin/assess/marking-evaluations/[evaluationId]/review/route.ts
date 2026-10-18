import { Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { buildSchoolUserAuditContext } from "@/lib/audit/fromApiRoute";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { AssessmentMarkingError, reviewMarkingEvaluation } from "@/lib/assess/assessment-marking-service";

const schema = z.object({ decision: z.enum(["approve", "return"]), reason: z.string().trim().min(3).max(2000) });

export async function POST(request: Request, { params }: { params: Promise<{ evaluationId: string }> }) {
  try {
    const admin = await requireSchoolAdmin();
    const premium = await requireAssessPremiumPublication(admin.schoolId);
    if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode });
    const { evaluationId } = await params;
    if (!Types.ObjectId.isValid(evaluationId)) return Response.json({ success: false, error: "Invalid marking evaluation id" }, { status: 400 });
    const idempotencyKey = request.headers.get("x-idempotency-key")?.trim();
    if (!idempotencyKey) return Response.json({ success: false, error: "x-idempotency-key is required" }, { status: 400 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ success: false, error: "Invalid marking review request" }, { status: 400 });
    await connectToDatabase();
    const result = await reviewMarkingEvaluation({ actor: { userId: admin.userId, schoolId: admin.schoolId, isAdmin: true, premiumPublicationEntitled: true }, markingEvaluationId: new Types.ObjectId(evaluationId), decision: parsed.data.decision, reason: parsed.data.reason, idempotencyKey, auditContext: buildSchoolUserAuditContext(request, { userId: admin.userId, schoolId: admin.schoolId, actorRole: "school_admin", idempotencyKey }) });
    return Response.json({ success: true, replayed: result.replayed, data: { evaluationId: String(result.evaluation._id), status: result.evaluation.status, revisionNumber: result.revision.revisionNumber, approvedOutcome: result.approvedOutcome ?? null } });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof AssessmentMarkingError) return Response.json({ success: false, error: error.message }, { status: error.status });
    return Response.json({ success: false, error: "Failed to review marking evaluation" }, { status: 500 });
  }
}
