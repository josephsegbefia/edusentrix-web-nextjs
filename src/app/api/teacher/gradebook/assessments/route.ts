import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { GradingScale } from "@/models/GradingScale";
import { School, type ISchool } from "@/models/School";
import { PERMISSIONS } from "@/lib/rbac";
import { can } from "@/lib/auth/can";
import {
  getCurriculumProfile,
  type AssessmentModel,
} from "@/constants/curriculum-profiles";

type AssessmentTypeOption = { value: string; label: string };

const BASE_TYPES: AssessmentTypeOption[] = [
  { value: "ca", label: "Continuous Assessment" },
  { value: "quiz", label: "Quiz" },
  { value: "assignment", label: "Assignment" },
  { value: "midterm", label: "Midterm" },
  { value: "project", label: "Project" },
  { value: "exam", label: "Exam" },
  { value: "mock", label: "Mock" },
];

const ASSESSMENT_TYPES_BY_MODEL: Record<AssessmentModel, AssessmentTypeOption[]> =
  {
    ca_exam: BASE_TYPES,
    criteria_rubric: [
      { value: "criterion", label: "Criterion" },
      { value: "project", label: "Project" },
      { value: "assignment", label: "Assignment" },
      { value: "exam", label: "Exam" },
    ],
    standards_based: [
      { value: "formative", label: "Formative Assessment" },
      { value: "classwork", label: "Classwork" },
      { value: "homework", label: "Homework" },
      { value: "project", label: "Project" },
      { value: "exam", label: "End-of-Key-Stage Test" },
    ],
    portfolio: [
      { value: "portfolio", label: "Portfolio Entry" },
      { value: "formative", label: "Formative Assessment" },
      { value: "project", label: "Project" },
      { value: "classwork", label: "Classwork" },
    ],
    points_average: [
      { value: "classwork", label: "Classwork" },
      { value: "homework", label: "Homework" },
      { value: "quiz", label: "Quiz" },
      { value: "assignment", label: "Assignment" },
      { value: "midterm", label: "Midterm" },
      { value: "project", label: "Project" },
      { value: "final", label: "Final Exam" },
    ],
    custom: BASE_TYPES,
  };

export async function GET() {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.gradebookView)) {
      return Response.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const [gradingScale, school] = await Promise.all([
      GradingScale.findOne({
        schoolId: context.schoolId,
        isDefault: true,
      })
        .select("name caWeight examWeight gradeMappings passThreshold")
        .lean(),
      School.findById(context.schoolId)
        .select("curriculumCode")
        .lean() as Promise<Pick<ISchool, "curriculumCode"> | null>,
    ]);

    const curriculumCode = school?.curriculumCode || "ghana_nacca";
    const profile = getCurriculumProfile(curriculumCode);
    const assessmentTypes =
      ASSESSMENT_TYPES_BY_MODEL[profile.assessmentModel] || BASE_TYPES;

    return Response.json({
      success: true,
      data: {
        assessmentTypes,
        assessmentModel: profile.assessmentModel,
        curriculumCode,
        gradingScale: gradingScale
          ? {
              name: gradingScale.name,
              caWeight: gradingScale.caWeight,
              examWeight: gradingScale.examWeight,
              passThreshold: (gradingScale as any).passThreshold ?? 50,
              gradeMappings: gradingScale.gradeMappings || [],
            }
          : {
              name: profile.label,
              caWeight: profile.defaultCaWeight,
              examWeight: profile.defaultExamWeight,
              passThreshold: profile.passThreshold,
              gradeMappings: [],
            },
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load gradebook assessment metadata:", e);
    const message =
      e instanceof Error
        ? e.message
        : "Failed to load gradebook metadata";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
