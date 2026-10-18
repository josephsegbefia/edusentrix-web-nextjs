import { requireTeacher } from "@/lib/auth/requireTeacher";
import { requireAssessPremiumPublication } from "@/lib/subscriptions/assess-premium";
import { AssessmentMarkingError, listMarkerAssignments } from "@/lib/assess/assessment-marking-service";

export async function GET() {
  try {
    const teacher = await requireTeacher();
    const premium = await requireAssessPremiumPublication(teacher.schoolId);
    if (!premium.allowed) return Response.json({ success: false, error: premium.reason }, { status: premium.statusCode });
    const data = await listMarkerAssignments({ actor: { userId: teacher.userId, schoolId: teacher.schoolId, teacherId: teacher.teacherId, isAdmin: teacher.isAdmin, premiumPublicationEntitled: true } });
    return Response.json({ success: true, data });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof AssessmentMarkingError) return Response.json({ success: false, error: error.message }, { status: error.status });
    return Response.json({ success: false, error: "Failed to load marking queue" }, { status: 500 });
  }
}
