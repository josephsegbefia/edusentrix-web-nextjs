import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { AssessmentMarkingError, getAdminEvaluation } from "@/lib/assess/assessment-marking-service";

export async function GET(_request: Request, { params }: { params: Promise<{ evaluationId: string }> }) {
  try {
    const admin = await requireSchoolAdmin();
    const premium = await requireAssessPremiumPublication(admin.schoolId);
    if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode });
    const { evaluationId } = await params;
    if (!Types.ObjectId.isValid(evaluationId)) return Response.json({ success: false, error: "Invalid marking evaluation id" }, { status: 400 });
    await connectToDatabase();
    const data = await getAdminEvaluation({ actor: { userId: admin.userId, schoolId: admin.schoolId, isAdmin: true, premiumPublicationEntitled: true }, markingEvaluationId: new Types.ObjectId(evaluationId) });
    return Response.json({ success: true, data });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof AssessmentMarkingError) return Response.json({ success: false, error: error.message }, { status: error.status });
    return Response.json({ success: false, error: "Failed to load marking evaluation" }, { status: 500 });
  }
}
