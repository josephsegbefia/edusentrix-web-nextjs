import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import {
  createAssessmentItem,
  parseCreateAssessmentItemBody,
} from "@/lib/academics/assessment-engine/assessment-item-service";

export async function POST(req: NextRequest) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.gradebookRecord)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const parsedBody = parseCreateAssessmentItemBody(await req.json());
    if (!parsedBody.ok) {
      return NextResponse.json({ success: false, error: parsedBody.error }, { status: 400 });
    }

    const result = await createAssessmentItem(
      {
        schoolId: context.schoolId,
        teacherId: context.teacherId,
        userId: context.userId,
        isAdmin: context.isAdmin,
      },
      parsedBody.data
    );

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Assessment items POST:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create assessment item" },
      { status: 500 }
    );
  }
}
