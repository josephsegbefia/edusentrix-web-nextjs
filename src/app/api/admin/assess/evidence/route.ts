import { Types } from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AssessmentEvidenceError, listEvidenceReconciliation } from "@/lib/assess/assessment-evidence-service";

export async function GET(request: Request) {
  try {
    const admin = await requireSchoolAdmin(); const premium = await requireAssessPremiumPublication(admin.schoolId); if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode });
    const query = new URL(request.url).searchParams; const delivery = query.get("assessmentDeliveryVersionId"); const session = query.get("sessionId");
    if (delivery && !Types.ObjectId.isValid(delivery)) return Response.json({ success: false, error: "Invalid assessment delivery id" }, { status: 400 });
    if (session && !Types.ObjectId.isValid(session)) return Response.json({ success: false, error: "Invalid capture session id" }, { status: 400 });
    await connectToDatabase();
    const data = await listEvidenceReconciliation({ actor: { userId: admin.userId, schoolId: admin.schoolId, isAdmin: true, premiumPublicationEntitled: true }, assessmentDeliveryVersionId: delivery ? new Types.ObjectId(delivery) : null, sessionId: session ? new Types.ObjectId(session) : null });
    return Response.json({ success: true, data });
  } catch (error) { if (error instanceof Response) return error; if (error instanceof AssessmentEvidenceError) return Response.json({ success: false, error: error.message }, { status: error.status }); return Response.json({ success: false, error: "Failed to load evidence reconciliation" }, { status: 500 }); }
}
