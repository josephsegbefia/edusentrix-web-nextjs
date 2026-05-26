import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent, verifyGuardianAccess } from "@/lib/auth/requireParent";
import { getParentDailyQuestSummary } from "@/lib/learn/daily-quest-review";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await ctx.params;
    if (!Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid student id." },
        { status: 400 }
      );
    }

    const parent = await requireParent();
    await connectToDatabase();
    await verifyGuardianAccess(parent.userId, studentId);

    const days = Number(request.nextUrl.searchParams.get("days") ?? 14);
    const result = await getParentDailyQuestSummary({
      schoolId: parent.schoolId,
      studentId: new Types.ObjectId(studentId),
      days: Number.isFinite(days) ? days : 14,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.friendlyMessage, code: result.code },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[parent/learn/wards/[studentId]/daily-quest/summary:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Daily Quest summary." },
      { status: 500 }
    );
  }
}
