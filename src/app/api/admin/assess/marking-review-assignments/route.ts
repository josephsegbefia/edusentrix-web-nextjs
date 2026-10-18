import { Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { buildSchoolUserAuditContext } from "@/lib/audit/fromApiRoute";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { AssessmentMarkingError, assignMarkingReviewer } from "@/lib/assess/assessment-marking-service";

const schema = z.object({
  markingAssignmentId: z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid marking assignment id"),
  reviewerUserId: z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid reviewer user id"),
});

export async function POST(request: Request) {
  try {
    const admin = await requireSchoolAdmin();
    const premium = await requireAssessPremiumPublication(admin.schoolId);
    if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode });
    const idempotencyKey = request.headers.get("x-idempotency-key")?.trim();
    if (!idempotencyKey) return Response.json({ success: false, error: "x-idempotency-key is required" }, { status: 400 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ success: false, error: "Invalid reviewer assignment request" }, { status: 400 });
    await connectToDatabase();
    const result = await assignMarkingReviewer({ actor: { userId: admin.userId, schoolId: admin.schoolId, isAdmin: true, premiumPublicationEntitled: true }, markingAssignmentId: new Types.ObjectId(parsed.data.markingAssignmentId), reviewerUserId: new Types.ObjectId(parsed.data.reviewerUserId), idempotencyKey, auditContext: buildSchoolUserAuditContext(request, { userId: admin.userId, schoolId: admin.schoolId, actorRole: "school_admin", idempotencyKey }) });
    return Response.json({ success: true, replayed: result.replayed, data: result.reviewerAssignment }, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof AssessmentMarkingError) return Response.json({ success: false, error: error.message }, { status: error.status });
    return Response.json({ success: false, error: "Failed to assign moderation reviewer" }, { status: 500 });
  }
}
