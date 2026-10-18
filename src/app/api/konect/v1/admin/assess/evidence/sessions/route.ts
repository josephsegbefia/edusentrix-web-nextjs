import { Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { buildSchoolUserAuditContext } from "@/lib/audit/fromApiRoute";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { AssessmentEvidenceError, createEvidenceCaptureSession } from "@/lib/assess/assessment-evidence-service";

const schema = z.object({ assessmentDeliveryVersionId: z.string().refine(Types.ObjectId.isValid), deviceSessionId: z.string().trim().min(8).max(160) });

export async function POST(request: Request) {
  try {
    const admin = await requireSchoolAdmin();
    const premium = await requireAssessPremiumPublication(admin.schoolId);
    if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode });
    const key = request.headers.get("x-idempotency-key")?.trim();
    if (!key) return Response.json({ success: false, error: "x-idempotency-key is required" }, { status: 400 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ success: false, error: "Invalid evidence capture session request" }, { status: 400 });
    await connectToDatabase();
    const result = await createEvidenceCaptureSession({ actor: { userId: admin.userId, schoolId: admin.schoolId, isAdmin: true, premiumPublicationEntitled: true }, assessmentDeliveryVersionId: new Types.ObjectId(parsed.data.assessmentDeliveryVersionId), deviceSessionId: parsed.data.deviceSessionId, idempotencyKey: key, auditContext: buildSchoolUserAuditContext(request, { userId: admin.userId, schoolId: admin.schoolId, actorRole: "school_admin", idempotencyKey: key }) });
    return Response.json({ success: true, replayed: result.replayed, data: result.session }, { status: result.replayed ? 200 : 201 });
  } catch (error) { return evidenceError(error, "Failed to create evidence capture session"); }
}

function evidenceError(error: unknown, fallback: string) {
  if (error instanceof Response) return error;
  if (error instanceof AssessmentEvidenceError) return Response.json({ success: false, error: error.message }, { status: error.status });
  return Response.json({ success: false, error: fallback }, { status: 500 });
}
