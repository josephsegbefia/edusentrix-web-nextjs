import { connectToDatabase } from "@/db/connectToDatabase";
import { requireSchoolMember } from "@/lib/auth/requireSchoolMember";
import { ensureDefaultExamTypesForSchool } from "@/lib/examinations/exam-type-seeds";
import { serializeExamType } from "@/lib/examinations/serializers";
import { ExamType } from "@/models/ExamType";

export async function GET() {
  try {
    const ctx = await requireSchoolMember({
      allowedRoles: ["school_admin", "teacher", "staff"],
    });
    await connectToDatabase();
    await ensureDefaultExamTypesForSchool(ctx.schoolId);

    const examTypes = await ExamType.find({
      schoolId: ctx.schoolId,
      status: { $ne: "archived" },
    })
      .sort({ name: 1 })
      .lean();

    return Response.json({
      success: true,
      data: examTypes.map(serializeExamType),
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return Response.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch exam types",
      },
      { status: 500 }
    );
  }
}
