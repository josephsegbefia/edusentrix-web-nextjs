import { NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import { compileHomeroomReportRun } from "@/lib/academics/reporting/report-card-run-service";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.gradebookPublish)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const result = await compileHomeroomReportRun(
      {
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        userId: context.userId,
        homeroomClassGroupId: context.homeroomClassGroupId,
        isAdmin: context.isAdmin,
      },
      id
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
    console.error("Homeroom report run compile POST:", error);
    return NextResponse.json(
      { success: false, error: "Failed to compile report run" },
      { status: 500 }
    );
  }
}
