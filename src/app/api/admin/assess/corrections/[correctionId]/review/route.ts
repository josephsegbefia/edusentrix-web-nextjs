import { Types } from "mongoose";
import { z } from "zod";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { buildSchoolUserAuditContext } from "@/lib/audit/fromApiRoute";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AssessmentPaperAssignmentError, reviewAssessmentPacketCorrection } from "@/lib/assess/assessment-paper-assignment-service";

const schema = z.object({ decision: z.enum(["approve", "reject"]), decisionReason: z.string().trim().min(3).max(2000) });
export async function POST(request: Request, { params }: { params: Promise<{ correctionId: string }> }) {
  try {
    const admin = await requireSchoolAdmin();
    const premium = await requireAssessPremiumPublication(admin.schoolId);
    if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode });
    const { correctionId } = await params;
    const key = request.headers.get("x-idempotency-key")?.trim();
    if (!Types.ObjectId.isValid(correctionId) || !key) return Response.json({ success: false, error: "Valid correction id and x-idempotency-key are required" }, { status: 400 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ success: false, error: "Invalid correction decision" }, { status: 400 });
    await connectToDatabase();
    const result = await reviewAssessmentPacketCorrection({ actor: { userId: admin.userId, schoolId: admin.schoolId, isAdmin: true, premiumPublicationEntitled: true }, correctionId: new Types.ObjectId(correctionId), decision: parsed.data.decision, decisionReason: parsed.data.decisionReason, idempotencyKey: key, auditContext: buildSchoolUserAuditContext(request, { userId: admin.userId, schoolId: admin.schoolId, actorRole: "school_admin", idempotencyKey: key }) });
    return Response.json({ success: true, replayed: result.replayed, data: result }, { status: result.replayed ? 200 : 200 });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof AssessmentPaperAssignmentError) return Response.json({ success: false, error: error.message }, { status: error.status });
    return Response.json({ success: false, error: "Failed to review identity correction" }, { status: 500 });
  }
}

