import { Types } from "mongoose";
import { z } from "zod";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { buildSchoolUserAuditContext } from "@/lib/audit/fromApiRoute";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AssessmentEvidenceError, requestEvidenceDeletion } from "@/lib/assess/assessment-evidence-service";
const schema = z.object({ reason: z.string().trim().min(3).max(2000) });
export async function POST(request: Request, { params }: { params: Promise<{ evidencePageId: string }> }) {
  try { const admin = await requireSchoolAdmin(); const premium = await requireAssessPremiumPublication(admin.schoolId); if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode }); const { evidencePageId } = await params; if (!Types.ObjectId.isValid(evidencePageId)) return Response.json({ success: false, error: "Invalid evidence page id" }, { status: 400 }); const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return Response.json({ success: false, error: "A deletion reason is required" }, { status: 400 }); const key = request.headers.get("x-idempotency-key")?.trim() || `delete:${evidencePageId}`; await connectToDatabase(); const data = await requestEvidenceDeletion({ actor: { userId: admin.userId, schoolId: admin.schoolId, isAdmin: true, premiumPublicationEntitled: true }, evidencePageId: new Types.ObjectId(evidencePageId), reason: parsed.data.reason, requestKey: key, auditContext: buildSchoolUserAuditContext(request, { userId: admin.userId, schoolId: admin.schoolId, actorRole: "school_admin", idempotencyKey: key }) }); return Response.json({ success: true, data }); }
  catch (error) { if (error instanceof Response) return error; if (error instanceof AssessmentEvidenceError) return Response.json({ success: false, error: error.message }, { status: error.status }); return Response.json({ success: false, error: "Failed to request evidence deletion" }, { status: 500 }); }
}
