import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { School, type ISchool } from "@/models/School";
import { Assessment } from "@/models/Assessment";
import { SubjectGrade } from "@/models/SubjectGrade";
import {
  getCurriculumProfile,
  CURRICULUM_OPTIONS,
  type CurriculumCode,
} from "@/constants/curriculum-profiles";
import { CURRICULUM_GRADE_TEMPLATES } from "@/constants/curriculum-grade-templates";
import { CURRICULUM_SUBJECT_TEMPLATES } from "@/constants/curriculum-subject-templates";
import { GRADING_PRESETS } from "@/constants/curriculum-grading-presets";
import mongoose from "mongoose";

async function getAcademicDataStatus(schoolId: string | mongoose.Types.ObjectId) {
  const [assessmentCount, publishedGradeCount] = await Promise.all([
    Assessment.countDocuments({ schoolId }),
    SubjectGrade.countDocuments({ schoolId }),
  ]);

  return {
    hasAssessments: assessmentCount > 0,
    hasPublishedGrades: publishedGradeCount > 0,
    assessmentCount,
    publishedGradeCount,
    canSwitch: assessmentCount === 0 && publishedGradeCount === 0,
  };
}

export async function GET() {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const school = (await School.findById(schoolId)
      .select("curriculumCode type pendingCurriculumCode pendingCurriculumEffective")
      .lean()) as (Pick<ISchool, "curriculumCode" | "type"> & {
      pendingCurriculumCode?: string | null;
      pendingCurriculumEffective?: string | null;
    }) | null;

    if (!school) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    const currentCode = (school.curriculumCode || "ghana_nacca") as CurriculumCode;
    const currentProfile = getCurriculumProfile(currentCode);
    const academicData = await getAcademicDataStatus(schoolId);

    const allOptions = CURRICULUM_OPTIONS.map((profile) => ({
      code: profile.code,
      label: profile.label,
      description: profile.description,
      assessmentModel: profile.assessmentModel,
      gradingSystem: profile.gradingSystem,
      termStructure: profile.termStructure,
      gradeCount: CURRICULUM_GRADE_TEMPLATES[profile.code]?.length || 0,
      subjectCount: CURRICULUM_SUBJECT_TEMPLATES[profile.code]?.length || 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        currentCurriculum: {
          ...currentProfile,
          grades: CURRICULUM_GRADE_TEMPLATES[currentCode] || [],
          subjects: CURRICULUM_SUBJECT_TEMPLATES[currentCode] || [],
          gradingPreset: GRADING_PRESETS[currentCode],
        },
        availableCurricula: allOptions,
        academicData,
        pendingCurriculum: school.pendingCurriculumCode
          ? {
              code: school.pendingCurriculumCode,
              label: getCurriculumProfile(
                school.pendingCurriculumCode as CurriculumCode
              ).label,
              effectiveDate: school.pendingCurriculumEffective || null,
            }
          : null,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to load curriculum info:", e);
    return NextResponse.json(
      { success: false, error: "Failed to load curriculum info" },
      { status: 500 }
    );
  }
}

const CURRICULUM_CODES = [
  "ghana_nacca",
  "cambridge",
  "ib_pyp",
  "ib_myp",
  "british_nc",
  "american",
  "hybrid",
] as const;

const UpdateSchema = z.object({
  curriculumCode: z.enum(CURRICULUM_CODES),
  force: z.boolean().optional(),
  scheduleForNextYear: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const academicData = await getAcademicDataStatus(schoolId);

    if (parsed.data.scheduleForNextYear) {
      await School.updateOne(
        { _id: schoolId },
        {
          $set: {
            pendingCurriculumCode: parsed.data.curriculumCode,
            pendingCurriculumEffective: "next_academic_year",
          },
        }
      );

      const profile = getCurriculumProfile(
        parsed.data.curriculumCode as CurriculumCode
      );

      return NextResponse.json({
        success: true,
        scheduled: true,
        data: {
          curriculumCode: parsed.data.curriculumCode,
          profile,
        },
      });
    }

    if (!academicData.canSwitch && !parsed.data.force) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot switch curriculum while academic data exists",
          code: "ACADEMIC_DATA_EXISTS",
          academicData,
        },
        { status: 409 }
      );
    }

    await School.updateOne(
      { _id: schoolId },
      {
        $set: { curriculumCode: parsed.data.curriculumCode },
        $unset: {
          pendingCurriculumCode: "",
          pendingCurriculumEffective: "",
        },
      }
    );

    const profile = getCurriculumProfile(
      parsed.data.curriculumCode as CurriculumCode
    );

    return NextResponse.json({
      success: true,
      data: {
        curriculumCode: parsed.data.curriculumCode,
        profile,
      },
    });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to update curriculum:", e);
    return NextResponse.json(
      { success: false, error: "Failed to update curriculum" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    await School.updateOne(
      { _id: schoolId },
      {
        $unset: {
          pendingCurriculumCode: "",
          pendingCurriculumEffective: "",
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("Failed to cancel pending curriculum:", e);
    return NextResponse.json(
      { success: false, error: "Failed to cancel" },
      { status: 500 }
    );
  }
}
