import { Types } from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AssessmentEvidenceError, getEvidencePreview } from "@/lib/assess/assessment-evidence-service";
export async function GET(_request: Request, { params }: { params: Promise<{ evidencePageId: string }> }) {
  try { const admin = await requireSchoolAdmin(); const premium = await requireAssessPremiumPublication(admin.schoolId); if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode }); const { evidencePageId } = await params; if (!Types.ObjectId.isValid(evidencePageId)) return Response.json({ success: false, error: "Invalid evidence page id" }, { status: 400 }); await connectToDatabase(); const data = await getEvidencePreview({ actor: { userId: admin.userId, schoolId: admin.schoolId, isAdmin: true, premiumPublicationEntitled: true }, evidencePageId: new Types.ObjectId(evidencePageId) }); return Response.redirect(data.redirectUrl, 302); }
  catch (error) { if (error instanceof Response) return error; if (error instanceof AssessmentEvidenceError) return Response.json({ success: false, error: error.message }, { status: error.status }); return Response.json({ success: false, error: "Failed to create private evidence preview" }, { status: 500 }); }
}
