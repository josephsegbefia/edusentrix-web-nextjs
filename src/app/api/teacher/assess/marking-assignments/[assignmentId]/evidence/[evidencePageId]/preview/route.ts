import { Types } from "mongoose";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { AssessmentMarkingError, getMarkingEvidencePreview } from "@/lib/assess/assessment-marking-service";

export async function GET(_request: Request, { params }: { params: Promise<{ assignmentId: string; evidencePageId: string }> }) {
  try {
    const teacher = await requireTeacher();
    const premium = await requireAssessPremiumPublication(teacher.schoolId);
    if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode });
    const { assignmentId, evidencePageId } = await params;
    if (!Types.ObjectId.isValid(assignmentId) || !Types.ObjectId.isValid(evidencePageId)) return Response.json({ success: false, error: "Invalid marking evidence reference" }, { status: 400 });
    const data = await getMarkingEvidencePreview({ actor: { userId: teacher.userId, schoolId: teacher.schoolId, teacherId: teacher.teacherId, isAdmin: teacher.isAdmin, premiumPublicationEntitled: true }, markingAssignmentId: new Types.ObjectId(assignmentId), evidencePageId: new Types.ObjectId(evidencePageId) });
    return Response.redirect(data.redirectUrl, 302);
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof AssessmentMarkingError) return Response.json({ success: false, error: error.message }, { status: error.status });
    return Response.json({ success: false, error: "Failed to create private marking preview" }, { status: 500 });
  }
}
