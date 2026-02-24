// src/app/api/admin/grades/seed/route.ts
import { NextRequest } from "next/server";
import { requireSchoolAdmin } from "@/lib/auth/requireSchoolAdmin";
import { connectToDatabase } from "@/db/connectToDatabase";
import { Grade } from "@/models/Grade";
import { School, type ISchool } from "@/models/School";
import { getGradeTemplatesForCurriculum } from "@/constants/curriculum-grade-templates";
import { GRADE_TEMPLATES } from "@/constants/grade-templates";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_req: NextRequest) {
  try {
    const { schoolId } = await requireSchoolAdmin();
    await connectToDatabase();

    const school = (await School.findById(schoolId).lean()) as ISchool | null;
    if (!school) return new Response("School not found", { status: 404 });

    const curriculumCode = school.curriculumCode || "ghana_nacca";

    let tpl = getGradeTemplatesForCurriculum(curriculumCode, school.type);

    if (tpl.length === 0) {
      const legacyType: "Basic" | "SHS" =
        school.type === "SHS" ? "SHS" : "Basic";
      tpl = [...GRADE_TEMPLATES[legacyType]];
    }

    if (tpl.length === 0) {
      return new Response("No grade template found for this curriculum", {
        status: 400,
      });
    }

    await Promise.all(
      tpl.map((g) =>
        Grade.updateOne(
          { schoolId, code: g.code },
          {
            $setOnInsert: {
              schoolId,
              name: g.name,
              code: g.code,
              stage: g.stage,
              order: g.order,
              isActive: true,
            },
          },
          { upsert: true }
        )
      )
    );

    return Response.json({ success: true });
  } catch (e: unknown) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Failed to seed grades";
    return new Response(message, { status: 500 });
  }
}
