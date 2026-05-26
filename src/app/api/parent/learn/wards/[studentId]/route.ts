import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/db/connectToDatabase";
import { requireParent, verifyGuardianAccess } from "@/lib/auth/requireParent";
import { getParentLearnOverview } from "@/lib/learn/parent-learn-overview";

export async function GET(
  _req: Request,
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

    const data = await getParentLearnOverview(
      parent.schoolId,
      parent.userId,
      new Types.ObjectId(studentId)
    );
    const ward = data.wards[0] || null;

    return NextResponse.json({
      success: true,
      data: {
        pricePerStudentPerTermMinor: data.pricePerStudentPerTermMinor,
        currency: data.currency,
        schoolEligibility: data.schoolEligibility,
        ward,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error("[parent/learn/wards/[studentId]:GET]", error);
    return NextResponse.json(
      { success: false, error: "Failed to load ward Learn details." },
      { status: 500 }
    );
  }
}
