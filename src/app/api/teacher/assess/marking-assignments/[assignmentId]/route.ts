import { Types } from "mongoose";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { AssessmentMarkingError, getMarkerEvaluation } from "@/lib/assess/assessment-marking-service";

export async function GET(_request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const teacher = await requireTeacher();
    const premium = await requireAssessPremiumPublication(teacher.schoolId);
    if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode });
    const { assignmentId } = await params;
    if (!Types.ObjectId.isValid(assignmentId)) return Response.json({ success: false, error: "Invalid marking assignment id" }, { status: 400 });
    const data = await getMarkerEvaluation({ actor: { userId: teacher.userId, schoolId: teacher.schoolId, teacherId: teacher.teacherId, isAdmin: teacher.isAdmin, premiumPublicationEntitled: true }, markingAssignmentId: new Types.ObjectId(assignmentId) });
    return Response.json({ success: true, data });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof AssessmentMarkingError) return Response.json({ success: false, error: error.message }, { status: error.status });
    return Response.json({ success: false, error: "Failed to load marking assignment" }, { status: 500 });
  }
}
