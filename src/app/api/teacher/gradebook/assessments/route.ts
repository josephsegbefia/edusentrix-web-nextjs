import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { GradingScale } from "@/models/GradingScale";
import { PERMISSIONS } from "@/lib/rbac";
import { can } from "@/lib/auth/can";

const ASSESSMENT_TYPES = [
  { value: "ca", label: "Continuous Assessment" },
  { value: "quiz", label: "Quiz" },
  { value: "assignment", label: "Assignment" },
  { value: "midterm", label: "Midterm" },
  { value: "project", label: "Project" },
  { value: "exam", label: "Exam" },
  { value: "mock", label: "Mock" },
];

export async function GET() {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.gradebookView)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const gradingScale = await GradingScale.findOne({
      schoolId: context.schoolId,
      isDefault: true,
    })
      .select("name caWeight examWeight gradeMappings")
      .lean();

    return Response.json({
      success: true,
      data: {
        assessmentTypes: ASSESSMENT_TYPES,
        gradingScale: gradingScale
          ? {
              name: gradingScale.name,
              caWeight: gradingScale.caWeight,
              examWeight: gradingScale.examWeight,
              gradeMappings: gradingScale.gradeMappings || [],
            }
          : {
              name: "Default",
              caWeight: 0.3,
              examWeight: 0.7,
              gradeMappings: [],
            },
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load gradebook assessment metadata:", e);
    const message = e instanceof Error ? e.message : "Failed to load gradebook metadata";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
