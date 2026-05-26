import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent, verifyGuardianAccess } from "@/lib/auth/requireParent";
import { getParentExploreSummaryForStudent } from "@/lib/learn/explore/explore-parent-summary";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ studentId: string; adventureId: string }> }
) {
  try {
    const { studentId, adventureId } = await ctx.params;

    if (!Types.ObjectId.isValid(studentId)) {
      return NextResponse.json(
        { success: false, error: "Invalid student id." },
        { status: 400 }
      );
    }

    const parent = await requireParent();
    await connectToDatabase();
    await verifyGuardianAccess(parent.userId, studentId);

    const result = await getParentExploreSummaryForStudent({
      schoolId: parent.schoolId,
      studentId: new Types.ObjectId(studentId),
      adventureId,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.friendlyMessage,
          code: result.code,
        },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[parent/learn/wards/.../explore/summary:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load Explore summary." },
      { status: 500 }
    );
  }
}
