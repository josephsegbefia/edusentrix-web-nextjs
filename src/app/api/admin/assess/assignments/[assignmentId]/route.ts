import { Types } from "mongoose";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { connectToDatabase } from "@/db/connectToDatabase";
import { AssessmentPaperAssignmentError, getAssessmentPacketAssignment } from "@/lib/assess/assessment-paper-assignment-service";

export async function GET(_request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const admin = await requireSchoolAdmin();
    const premium = await requireAssessPremiumPublication(admin.schoolId);
    if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode });
    const { assignmentId } = await params;
    if (!Types.ObjectId.isValid(assignmentId)) return Response.json({ success: false, error: "Invalid assignment id" }, { status: 400 });
    await connectToDatabase();
    const data = await getAssessmentPacketAssignment({ actor: { userId: admin.userId, schoolId: admin.schoolId, isAdmin: true, premiumPublicationEntitled: true }, assignmentId: new Types.ObjectId(assignmentId) });
    if (!data) return Response.json({ success: false, error: "Packet assignment not found" }, { status: 404 });
    return Response.json({ success: true, data });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof AssessmentPaperAssignmentError) return Response.json({ success: false, error: error.message }, { status: error.status });
    return Response.json({ success: false, error: "Failed to load packet assignment" }, { status: 500 });
  }
}

