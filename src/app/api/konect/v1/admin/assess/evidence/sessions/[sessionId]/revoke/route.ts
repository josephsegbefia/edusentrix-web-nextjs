import { Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { buildSchoolUserAuditContext } from "@/lib/audit/fromApiRoute";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { AssessmentEvidenceError, revokeEvidenceCaptureSession } from "@/lib/assess/assessment-evidence-service";
const schema = z.object({ reason: z.string().trim().min(3).max(1000) });
export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try { const admin = await requireSchoolAdmin(); const premium = await requireAssessPremiumPublication(admin.schoolId); if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode }); const { sessionId } = await params; if (!Types.ObjectId.isValid(sessionId)) return Response.json({ success: false, error: "Invalid capture session id" }, { status: 400 }); const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ success: false, error: "A revocation reason is required" }, { status: 400 }); const key = request.headers.get("x-idempotency-key")?.trim() || `revoke:${sessionId}`; await connectToDatabase(); const result = await revokeEvidenceCaptureSession({ actor: { userId: admin.userId, schoolId: admin.schoolId, isAdmin: true, premiumPublicationEntitled: true }, sessionId: new Types.ObjectId(sessionId), reason: parsed.data.reason, idempotencyKey: key, auditContext: buildSchoolUserAuditContext(request, { userId: admin.userId, schoolId: admin.schoolId, actorRole: "school_admin", idempotencyKey: key }) }); return Response.json({ success: true, replayed: result.replayed, data: result.session }); }
  catch (error) { if (error instanceof Response) return error; if (error instanceof AssessmentEvidenceError) return Response.json({ success: false, error: error.message }, { status: error.status }); return Response.json({ success: false, error: "Failed to revoke evidence capture session" }, { status: 500 }); }
}
