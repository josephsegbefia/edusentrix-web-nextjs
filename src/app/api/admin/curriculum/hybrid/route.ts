import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireSchoolAdminOrDelegatedAnyPermission,
  requireSchoolAdminOrDelegatedModuleView,
} from "@/lib/delegations/requireDelegatedModulePermission";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School, type ISchool } from "@/models/School";
import { CURRICULUM_GRADE_TEMPLATES } from "@/constants/curriculum-grade-templates";
import { CURRICULUM_SUBJECT_TEMPLATES } from "@/constants/curriculum-subject-templates";
import type { CurriculumCode } from "@/constants/curriculum-profiles";

export async function GET() {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedModuleView("curriculum");
    await connectToDatabase();

    const school = (await School.findById(schoolId)
      .select("curriculumCode")
      .lean()) as Pick<ISchool, "curriculumCode"> | null;

    if (!school) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    const allGrades: Record<string, unknown[]> = {};
    const allSubjects: Record<string, unknown[]> = {};

    for (const code of Object.keys(CURRICULUM_GRADE_TEMPLATES)) {
      const templates = CURRICULUM_GRADE_TEMPLATES[code as CurriculumCode];
      if (templates.length > 0) {
        allGrades[code] = templates;
      }
    }

    for (const code of Object.keys(CURRICULUM_SUBJECT_TEMPLATES)) {
      const templates = CURRICULUM_SUBJECT_TEMPLATES[code as CurriculumCode];
      if (templates.length > 0) {
        allSubjects[code] = templates;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        currentCurriculum: school.curriculumCode || "ghana_nacca",
        grades: allGrades,
        subjects: allSubjects,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load hybrid builder data:", e);
    return NextResponse.json(
      { success: false, error: "Failed to load hybrid builder data" },
      { status: 500 }
    );
  }
}

const HybridSaveSchema = z.object({
  selectedGrades: z.array(
    z.object({
      sourceCurriculum: z.string(),
      name: z.string(),
      code: z.string(),
      stage: z.string(),
      order: z.number(),
    })
  ),
  selectedSubjects: z.array(
    z.object({
      sourceCurriculum: z.string(),
      name: z.string(),
      code: z.string().optional(),
      category: z.string().optional(),
    })
  ),
  assessmentModel: z
    .enum([
      "ca_exam",
      "criteria_rubric",
      "standards_based",
      "portfolio",
      "points_average",
      "custom",
    ])
    .optional(),
  termStructure: z
    .enum(["three_terms", "two_semesters", "four_quarters", "trimesters"])
    .optional(),
  gradingSystem: z
    .enum([
      "letter_af",
      "ib_1_7",
      "cambridge_ag",
      "descriptive",
      "gpa_4",
      "custom",
    ])
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdminOrDelegatedAnyPermission([
      "curriculum.edit",
    ]);
    const body = await req.json();
    const parsed = HybridSaveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await connectToDatabase();

    await School.updateOne(
      { _id: schoolId },
      { $set: { curriculumCode: "hybrid" } }
    );

    return NextResponse.json({
      success: true,
      data: {
        curriculumCode: "hybrid",
        selectedGrades: parsed.data.selectedGrades,
        selectedSubjects: parsed.data.selectedSubjects,
        assessmentModel: parsed.data.assessmentModel ?? "custom",
        termStructure: parsed.data.termStructure ?? "three_terms",
        gradingSystem: parsed.data.gradingSystem ?? "custom",
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to save hybrid configuration:", e);
    return NextResponse.json(
      { success: false, error: "Failed to save hybrid configuration" },
      { status: 500 }
    );
  }
}
