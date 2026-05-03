import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { serializeCurriculumApi } from "@/lib/curricula/serialize-curriculum";
import { PERMISSIONS } from "@/lib/rbac";
import { Curriculum, type ICurriculum } from "@/models/Curriculum";
import { School } from "@/models/School";

export async function GET() {
  try {
    const ctx = await requireTeacher();
    if (!can(ctx.permissions, PERMISSIONS.curriculumFrameworkRead)) {
      return Response.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    await connectToDatabase();
    const school = await School.findById(ctx.schoolId).select("curriculumCode").lean();
    const schoolCode =
      typeof (school as { curriculumCode?: string } | null)?.curriculumCode === "string"
        ? (school as { curriculumCode: string }).curriculumCode.trim() || null
        : null;

    const docs = (await Curriculum.find({
      schoolId: ctx.schoolId,
      status: "active",
    })
      .limit(200)
      .lean()) as ICurriculum[];

    const sorted = [...docs].sort((a, b) => {
      const score = (row: ICurriculum) => {
        if (!schoolCode || !row.schoolCurriculumCode) return 1;
        return row.schoolCurriculumCode === schoolCode ? 0 : 1;
      };
      const diff = score(a) - score(b);
      if (diff !== 0) return diff;
      return a.title.localeCompare(b.title);
    });

    const curricula = sorted.map((row) =>
      serializeCurriculumApi(row, {
        matchesSchoolCurriculum: Boolean(
          schoolCode && row.schoolCurriculumCode && row.schoolCurriculumCode === schoolCode
        ),
      })
    );

    return Response.json({
      success: true,
      data: {
        schoolCurriculumCode: schoolCode,
        curricula,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to list curricula" },
      { status: 500 }
    );
  }
}
