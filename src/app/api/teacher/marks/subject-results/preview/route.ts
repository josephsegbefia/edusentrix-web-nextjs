import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import {
  parseSubjectResultScopeBody,
  previewSubjectResults,
} from "@/lib/academics/assessment-engine/subject-result-service";

export async function POST(req: NextRequest) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.gradebookView)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const parsedBody = parseSubjectResultScopeBody(await req.json());
    if (!parsedBody.ok) {
      return NextResponse.json({ success: false, error: parsedBody.error }, { status: 400 });
    }

    const result = await previewSubjectResults(
      {
        schoolId: context.schoolId,
        teacherId: context.teacherId,
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

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Subject results preview POST:", error);
    return NextResponse.json(
      { success: false, error: "Failed to preview subject results" },
      { status: 500 }
    );
  }
}
