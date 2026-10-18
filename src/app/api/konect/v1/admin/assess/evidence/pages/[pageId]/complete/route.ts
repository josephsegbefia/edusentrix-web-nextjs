import { Types } from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { buildSchoolUserAuditContext } from "@/lib/audit/fromApiRoute";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { AssessmentEvidenceError, completeEvidencePage } from "@/lib/assess/assessment-evidence-service";

const schema = z.object({ clientDigest: z.string().trim().optional() });
export async function POST(request: Request, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const admin = await requireSchoolAdmin(); const premium = await requireAssessPremiumPublication(admin.schoolId);
    if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode });
    const { pageId } = await params; if (!Types.ObjectId.isValid(pageId)) return Response.json({ success: false, error: "Invalid evidence page id" }, { status: 400 });
    const parsed = schema.safeParse(await request.json().catch(() => ({}))); if (!parsed.success) return Response.json({ success: false, error: "Invalid evidence completion request" }, { status: 400 });
    await connectToDatabase();
    const result = await completeEvidencePage({ actor: { userId: admin.userId, schoolId: admin.schoolId, isAdmin: true, premiumPublicationEntitled: true }, pageId: new Types.ObjectId(pageId), clientDigest: parsed.data.clientDigest, auditContext: buildSchoolUserAuditContext(request, { userId: admin.userId, schoolId: admin.schoolId, actorRole: "school_admin", idempotencyKey: `evidence-complete:${pageId}` }) });
    return Response.json({ success: true, replayed: result.replayed, data: result });
  } catch (error) { if (error instanceof Response) return error; if (error instanceof AssessmentEvidenceError) return Response.json({ success: false, error: error.message }, { status: error.status }); return Response.json({ success: false, error: "Failed to complete evidence page" }, { status: 500 }); }
}
