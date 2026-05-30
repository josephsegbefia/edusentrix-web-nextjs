import { NextRequest, NextResponse } from "next/server";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { connectToDatabase } from "@/db/connectToDatabase";
import { getTeacherGradebookV2 } from "@/lib/academics/assessment-engine/teacher-gradebook-service";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ classGroupId: string; subjectId: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.gradebookView)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { classGroupId, subjectId } = await ctx.params;
    const { searchParams } = new URL(req.url);

    const result = await getTeacherGradebookV2(
      {
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        isAdmin: context.isAdmin,
      },
      {
        classGroupId,
        subjectId,
        academicPeriodId: searchParams.get("academicPeriodId"),
      }
    );

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Teacher gradebook v2 GET:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load gradebook" },
      { status: 500 }
    );
  }
}
