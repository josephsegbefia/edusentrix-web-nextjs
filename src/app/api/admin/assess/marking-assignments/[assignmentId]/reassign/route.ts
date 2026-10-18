import { Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { buildSchoolUserAuditContext } from "@/lib/audit/fromApiRoute";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { AssessmentMarkingError, reassignMarkingScript } from "@/lib/assess/assessment-marking-service";

const schema = z.object({ markerUserId: z.string().refine((value) => Types.ObjectId.isValid(value), "Invalid marker user id"), reason: z.string().trim().min(3).max(2000), blindMarking: z.boolean().optional() });

export async function POST(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const admin = await requireSchoolAdmin();
    const premium = await requireAssessPremiumPublication(admin.schoolId);
    if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode });
    const { assignmentId } = await params;
    if (!Types.ObjectId.isValid(assignmentId)) return Response.json({ success: false, error: "Invalid marking assignment id" }, { status: 400 });
    const idempotencyKey = request.headers.get("x-idempotency-key")?.trim();
    if (!idempotencyKey) return Response.json({ success: false, error: "x-idempotency-key is required" }, { status: 400 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ success: false, error: "Invalid marking reassignment request" }, { status: 400 });
    await connectToDatabase();
    const result = await reassignMarkingScript({ actor: { userId: admin.userId, schoolId: admin.schoolId, isAdmin: true, premiumPublicationEntitled: true }, markingAssignmentId: new Types.ObjectId(assignmentId), markerUserId: new Types.ObjectId(parsed.data.markerUserId), blindMarking: parsed.data.blindMarking, reason: parsed.data.reason, idempotencyKey, auditContext: buildSchoolUserAuditContext(request, { userId: admin.userId, schoolId: admin.schoolId, actorRole: "school_admin", idempotencyKey }) });
    return Response.json({ success: true, replayed: result.replayed, data: result.assignment });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof AssessmentMarkingError) return Response.json({ success: false, error: error.message }, { status: error.status });
    return Response.json({ success: false, error: "Failed to reassign examination script" }, { status: 500 });
  }
}
