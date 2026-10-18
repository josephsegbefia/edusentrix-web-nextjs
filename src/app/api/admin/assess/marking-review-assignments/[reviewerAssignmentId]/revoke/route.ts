import { Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { buildSchoolUserAuditContext } from "@/lib/audit/fromApiRoute";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { AssessmentMarkingError, revokeMarkingReviewer } from "@/lib/assess/assessment-marking-service";

const schema = z.object({ reason: z.string().trim().min(3).max(2000) });

export async function POST(request: Request, { params }: { params: Promise<{ reviewerAssignmentId: string }> }) {
  try {
    const admin = await requireSchoolAdmin();
    const premium = await requireAssessPremiumPublication(admin.schoolId);
    if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode });
    const { reviewerAssignmentId } = await params;
    if (!Types.ObjectId.isValid(reviewerAssignmentId)) return Response.json({ success: false, error: "Invalid reviewer assignment id" }, { status: 400 });
    const idempotencyKey = request.headers.get("x-idempotency-key")?.trim();
    if (!idempotencyKey) return Response.json({ success: false, error: "x-idempotency-key is required" }, { status: 400 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ success: false, error: "Invalid reviewer revocation request" }, { status: 400 });
    await connectToDatabase();
    const result = await revokeMarkingReviewer({ actor: { userId: admin.userId, schoolId: admin.schoolId, isAdmin: true, premiumPublicationEntitled: true }, reviewerAssignmentId: new Types.ObjectId(reviewerAssignmentId), reason: parsed.data.reason, idempotencyKey, auditContext: buildSchoolUserAuditContext(request, { userId: admin.userId, schoolId: admin.schoolId, actorRole: "school_admin", idempotencyKey }) });
    return Response.json({ success: true, replayed: result.replayed, data: result.reviewerAssignment });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof AssessmentMarkingError) return Response.json({ success: false, error: error.message }, { status: error.status });
    return Response.json({ success: false, error: "Failed to revoke moderation reviewer" }, { status: 500 });
  }
}
