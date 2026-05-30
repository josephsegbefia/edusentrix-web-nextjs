import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import {
  parseUpdateAssessmentItemBody,
  updateAssessmentItem,
} from "@/lib/academics/assessment-engine/assessment-item-service";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.gradebookRecord)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const parsedBody = parseUpdateAssessmentItemBody(await req.json());
    if (!parsedBody.ok) {
      return NextResponse.json({ success: false, error: parsedBody.error }, { status: 400 });
    }

    const result = await updateAssessmentItem(
      {
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        userId: context.userId,
        isAdmin: context.isAdmin,
      },
      id,
      parsedBody.data
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
    console.error("Assessment item PATCH:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update assessment item" },
      { status: 500 }
    );
  }
}
