import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireTeacher } from "@/lib/auth/requireTeacher";
import { can } from "@/lib/auth/can";
import { PERMISSIONS } from "@/lib/rbac";
import {
  bulkUpsertAssessmentScores,
  parseBulkAssessmentScoresBody,
} from "@/lib/academics/assessment-engine/assessment-score-service";

export async function POST(req: NextRequest) {
  try {
    const context = await requireTeacher();
    await connectToDatabase();

    if (!can(context.permissions, PERMISSIONS.gradebookRecord)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const parsedBody = parseBulkAssessmentScoresBody(await req.json());
    if (!parsedBody.ok) {
      return NextResponse.json({ success: false, error: parsedBody.error }, { status: 400 });
    }

    const result = await bulkUpsertAssessmentScores(
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

    return NextResponse.json({
      success: true,
      data: result.data,
      updatedCount: result.updatedCount,
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    console.error("Assessment scores bulk POST:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record assessment scores" },
      { status: 500 }
    );
  }
}
